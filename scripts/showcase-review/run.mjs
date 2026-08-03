#!/usr/bin/env node

// Advisory pre-review for showcase contribution PRs.
//
// Pipeline: gather evidence (deterministic) -> ask the model for judgment -> post one
// comment. The deterministic half runs first so the model is reasoning over real
// validator output and real HTTP statuses instead of guessing.
//
// Reviews one PR, an explicit list, or every open PR (backfill):
//   PR_NUMBER=97          single PR (what the event-driven workflow sets)
//   PR_NUMBERS=97,96,70   explicit list
//   PR_NUMBERS=all        every open PR; non-showcase ones are skipped for free
//
// Set DRY_RUN=1 to print what would be posted without touching the PR.
//
// Local dry run:
//   GEMINI_API_KEY=... GITHUB_TOKEN=$(gh auth token) \
//   BASE_REPO=Virtual-Protocol/acp-cli-demos PR_NUMBERS=97,96 DRY_RUN=1 \
//   RUBRIC_PATH=/path/to/SKILL.md node scripts/showcase-review/run.mjs

import fs from 'node:fs'
import process from 'node:process'
import { gather_evidence, list_open_prs } from './gather.mjs'
import { request_review } from './gemini.mjs'
import { post_review, preview_body, screen_suggestions } from './post.mjs'

function require_env(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

async function resolve_target_prs({ base_repo, token }) {
  const raw = process.env.PR_NUMBERS?.trim()

  if (raw && raw.toLowerCase() !== 'all') {
    const numbers = raw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((number) => Number.isInteger(number) && number > 0)
    if (!numbers.length) {
      console.error(`PR_NUMBERS="${raw}" contained no valid PR numbers.`)
      process.exit(1)
    }
    return numbers
  }

  if (raw?.toLowerCase() === 'all') {
    const open = await list_open_prs({ base_repo, token })
    console.log(`Backfill: ${open.length} open PR(s) to consider.`)
    return open.map((pr) => pr.number)
  }

  return [Number(require_env('PR_NUMBER'))]
}

// Returns 'reviewed' | 'skipped' so the caller can summarize a batch.
async function review_one_pr({
  pr_number,
  base_repo,
  token,
  gemini_key,
  model,
  rubric,
  dry_run,
  event_head,
}) {
  const evidence = await gather_evidence({
    base_repo,
    // Only the event-driven single-PR run has a payload head to trust. In a batch
    // these must stay empty, or one PR's head sha would be used for all of them.
    head_repo: event_head?.repo || '',
    head_sha: event_head?.sha || '',
    pr_number,
    token,
    repo_root: process.cwd(),
  })

  console.log(
    `  ${evidence.changed_files.length} changed file(s), ` +
      `validator ${evidence.validator.passed ? 'passed' : 'FAILED'}, ` +
      `${evidence.url_checks.length} URL(s) checked.`,
  )

  // Cheap structural short-circuit, before spending a model call: nothing under
  // showcase/ means there is no package to review.
  const touches_showcase = evidence.changed_files.some((file) => file.path.startsWith('showcase/'))
  if (!touches_showcase) {
    console.log('  Skipped: no showcase/ files.')
    return 'skipped'
  }

  const review = await request_review({ api_key: gemini_key, model, rubric, evidence })

  // The model gets the final say on whether this is really a showcase contribution
  // (e.g. a maintainer editing showcase tooling rather than adding a package).
  if (!review.is_showcase_contribution) {
    console.log(`  Skipped: ${review.skip_reason || 'not a showcase contribution'}`)
    return 'skipped'
  }

  console.log(`  Scope: ${review.scope_verdict} — ${review.scope_reason}`)
  console.log(
    `  ${review.blockers?.length ?? 0} blocker(s), ` +
      `${review.should_fix?.length ?? 0} should-fix, ${review.minor?.length ?? 0} minor.`,
  )

  if (dry_run) {
    const screened = screen_suggestions({
      suggestions: review.inline_suggestions ?? [],
      package_files: evidence.package_files,
      baseline_passed: evidence.validator.passed,
    })
    console.log('\n--- DRY RUN: body that would be posted ---\n')
    console.log(
      preview_body({
        review,
        model,
        head_sha: evidence.head_sha,
        package_files: evidence.package_files,
        baseline_passed: evidence.validator.passed,
      }),
    )
    for (const item of screened.rejected) {
      console.log(`\n[dropped] ${item.path}:${item.line} — ${item.reason}`)
    }
    if (screened.kept.length) {
      console.log(`\n--- ${screened.kept.length} inline suggestion(s) that would post ---`)
      console.log(JSON.stringify(screened.kept, null, 2))
    } else {
      console.log('\n--- no inline suggestions would post ---')
    }
    console.log('\n--- end dry run ---\n')
    return 'reviewed'
  }

  const result = await post_review({
    base_repo,
    pr_number,
    token,
    head_sha: evidence.head_sha,
    review,
    model,
    package_files: evidence.package_files,
    baseline_passed: evidence.validator.passed,
  })
  console.log(`  ${result.updated ? 'Updated' : 'Posted'}: ${result.url}`)
  return 'reviewed'
}

async function main() {
  const github_token = require_env('GITHUB_TOKEN')
  const gemini_key = require_env('GEMINI_API_KEY')
  const rubric_path = require_env('RUBRIC_PATH')
  const base_repo = require_env('BASE_REPO')
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
  const dry_run = process.env.DRY_RUN === '1'

  const rubric = fs.readFileSync(rubric_path, 'utf8')
  if (rubric.trim().length < 500) {
    console.error('Rubric looks empty or truncated — refusing to review without it.')
    process.exit(1)
  }

  const pr_numbers = await resolve_target_prs({ base_repo, token: github_token })
  if (dry_run) console.log('DRY RUN — nothing will be posted.\n')

  const outcomes = { reviewed: 0, skipped: 0, failed: 0 }
  const event_head =
    pr_numbers.length === 1 && process.env.HEAD_SHA
      ? { repo: process.env.HEAD_REPO || '', sha: process.env.HEAD_SHA }
      : null

  // Sequential on purpose: keeps the log readable and stays clear of rate limits.
  for (const pr_number of pr_numbers) {
    console.log(`\n=== ${base_repo}#${pr_number} ===`)
    try {
      const outcome = await review_one_pr({
        pr_number,
        base_repo,
        token: github_token,
        gemini_key,
        model,
        rubric,
        dry_run,
        event_head,
      })
      outcomes[outcome] += 1
    } catch (error) {
      // One bad PR (deleted fork, force-push) must not abandon the rest of a backfill.
      outcomes.failed += 1
      console.error(`  Failed: ${error.message}`)
    }
  }

  if (pr_numbers.length > 1) {
    console.log(
      `\nDone: ${outcomes.reviewed} reviewed, ${outcomes.skipped} skipped, ${outcomes.failed} failed.`,
    )
  }

  // A single-PR run should surface its failure to the workflow; a batch reports and
  // carries on, so only fail the job when nothing succeeded.
  if (outcomes.failed > 0 && outcomes.reviewed === 0) process.exit(1)
}

main().catch((error) => {
  console.error(`Auto-review failed: ${error.message}`)
  process.exit(1)
})
