#!/usr/bin/env node

// Advisory pre-review for showcase contribution PRs.
//
// Pipeline: gather evidence (deterministic) -> ask the model for judgment -> post one
// comment. The deterministic half runs first so the model is reasoning over real
// validator output and real HTTP statuses instead of guessing.
//
// Local dry run (no comment posted):
//   GEMINI_API_KEY=... GITHUB_TOKEN=$(gh auth token) PR_NUMBER=42 \
//   BASE_REPO=Virtual-Protocol/acp-cli-demos DRY_RUN=1 \
//   RUBRIC_PATH=/path/to/SKILL.md node scripts/showcase-review/run.mjs

import fs from 'node:fs'
import process from 'node:process'
import { gather_evidence } from './gather.mjs'
import { request_review } from './gemini.mjs'
import { post_review } from './post.mjs'

function require_env(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

async function main() {
  const github_token = require_env('GITHUB_TOKEN')
  const gemini_key = require_env('GEMINI_API_KEY')
  const rubric_path = require_env('RUBRIC_PATH')
  const pr_number = Number(require_env('PR_NUMBER'))
  const base_repo = require_env('BASE_REPO')
  const head_sha = require_env('HEAD_SHA')
  const head_repo = process.env.HEAD_REPO || base_repo
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
  const dry_run = process.env.DRY_RUN === '1'

  const rubric = fs.readFileSync(rubric_path, 'utf8')
  if (rubric.trim().length < 500) {
    console.error('Rubric looks empty or truncated — refusing to review without it.')
    process.exit(1)
  }

  console.log(`Gathering evidence for ${base_repo}#${pr_number}...`)
  const evidence = await gather_evidence({
    base_repo,
    head_repo,
    head_sha,
    pr_number,
    token: github_token,
    repo_root: process.cwd(),
  })

  console.log(
    `Evidence: ${evidence.changed_files.length} changed file(s), ` +
      `validator ${evidence.validator.passed ? 'passed' : 'FAILED'}, ` +
      `${evidence.url_checks.length} URL(s) checked.`,
  )

  // Cheap structural short-circuit: nothing under showcase/ means there is no
  // package to review, whatever the path filter matched.
  const touches_showcase = evidence.changed_files.some((file) => file.path.startsWith('showcase/'))
  if (!touches_showcase) {
    console.log('No showcase/ files in this PR — nothing to review.')
    return
  }

  console.log(`Requesting review from ${model}...`)
  const review = await request_review({ api_key: gemini_key, model, rubric, evidence })

  // The model gets the final say on whether this is really a showcase contribution
  // (e.g. a maintainer editing showcase tooling rather than adding a package).
  if (!review.is_showcase_contribution) {
    console.log(`Not a showcase contribution — skipping. Reason: ${review.skip_reason || 'unspecified'}`)
    return
  }

  console.log(`Scope verdict: ${review.scope_verdict} — ${review.scope_reason}`)
  console.log(
    `Findings: ${review.blockers?.length ?? 0} blocker(s), ` +
      `${review.should_fix?.length ?? 0} should-fix, ${review.minor?.length ?? 0} minor.`,
  )

  if (dry_run) {
    console.log('\n--- DRY RUN: comment body that would be posted ---\n')
    console.log(review.overview_comment)
    if (review.inline_suggestions?.length) {
      console.log('\n--- inline suggestions ---')
      console.log(JSON.stringify(review.inline_suggestions, null, 2))
    }
    return
  }

  const result = await post_review({
    base_repo,
    pr_number,
    token: github_token,
    head_sha,
    review,
    model,
  })
  console.log(`${result.updated ? 'Updated' : 'Posted'} review comment: ${result.url}`)
}

main().catch((error) => {
  console.error(`Auto-review failed: ${error.message}`)
  process.exit(1)
})
