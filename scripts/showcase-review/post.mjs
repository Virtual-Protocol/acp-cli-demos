// Output layer: posts the draft review as ONE advisory comment, idempotently.
//
// Deliberately limited: event is always COMMENT. This never approves, never
// requests changes, and never merges.

import process from 'node:process'
import { run_validator } from './gather.mjs'

const GITHUB_API = 'https://api.github.com'
const MARKER = '<!-- showcase-auto-review:v1 -->'

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'showcase-auto-review',
  }
}

async function find_existing_comment({ base_repo, pr_number, token }) {
  for (let page = 1; page <= 5; page += 1) {
    const response = await fetch(
      `${GITHUB_API}/repos/${base_repo}/issues/${pr_number}/comments?per_page=100&page=${page}`,
      { headers: headers(token) },
    )
    if (!response.ok) throw new Error(`List comments failed: ${response.status}`)
    const comments = await response.json()
    const hit = comments.find((comment) => comment.body?.includes(MARKER))
    if (hit) return hit
    if (comments.length < 100) return null
  }
  return null
}

// A GitHub suggestion block is committed verbatim when the author clicks Apply, so a
// mis-anchored one silently corrupts the file. Simulate the apply and drop anything
// that doesn't survive it. This has caught real damage: suggestions aimed at a line
// number the model estimated rather than read, which would have replaced an unrelated
// key and left the manifest invalid.
export function screen_suggestions({
  suggestions,
  package_files,
  repo_root = process.cwd(),
  // Only meaningful if the PR validates to begin with; otherwise a failure after
  // patching can't be blamed on the suggestion.
  baseline_passed = false,
}) {
  const by_path = new Map(
    package_files.filter((file) => typeof file.text === 'string').map((file) => [file.path, file.text]),
  )

  const kept = []
  const rejected = []

  for (const item of suggestions) {
    const reject = (reason) => rejected.push({ ...item, reason })

    if (!item?.path || !item?.suggestion || !Number.isInteger(item.line) || item.line < 1) {
      reject('missing path, line, or suggestion')
      continue
    }

    const original = by_path.get(item.path)
    if (original === undefined) {
      reject('file is not among the PR files that were read')
      continue
    }

    const lines = original.split('\n')
    if (item.line > lines.length) {
      reject(`line ${item.line} is past the end of the file (${lines.length} lines)`)
      continue
    }

    if (lines[item.line - 1] === item.suggestion) {
      reject('suggestion is identical to the current line')
      continue
    }

    // Only JSON can be mechanically verified; markdown is judgement, so let it through.
    if (item.path.endsWith('.json')) {
      const patched = [...lines.slice(0, item.line - 1), item.suggestion, ...lines.slice(item.line)].join('\n')
      try {
        JSON.parse(patched)
      } catch (error) {
        reject(`applying it would break the JSON: ${error.message}`)
        continue
      }

      // Valid JSON is not enough. A suggestion anchored to the wrong line can still
      // parse while quietly deleting a required field — replacing builder.name with a
      // "topics" line parses fine and loses builder.name. Only the real validator
      // catches that, so re-run it over the patched manifest.
      if (baseline_passed && /^showcase\/[^/]+\/showcase\.json$/.test(item.path)) {
        const patched_files = package_files.map((file) =>
          file.path === item.path ? { ...file, text: patched } : file,
        )
        const result = run_validator({ package_files: patched_files, repo_root })
        if (!result.passed) {
          reject(`applying it would fail validation: ${result.output}`)
          continue
        }
      }
    }

    kept.push(item)
  }

  return { kept, rejected }
}

// A finding listed only in blockers/should_fix/minor never reaches the author — those
// arrays are a maintainer summary, not comment text. If the overview didn't carry the
// findings and there are no inline suggestions either, they'd be silently dropped, so
// append them rather than trusting the model to have written them out.
function find_undelivered_findings({ review, has_inline }) {
  const overview = (review.overview_comment ?? '').toLowerCase()
  const groups = [
    ['Blocker', review.blockers],
    ['Should fix', review.should_fix],
    ['Minor', review.minor],
  ]

  const missing = []
  for (const [label, items] of groups) {
    for (const item of Array.isArray(items) ? items : []) {
      if (typeof item !== 'string' || !item.trim()) continue
      // Cheap containment check: compare the finding's distinctive words against the
      // overview, so a reworded-but-present finding isn't duplicated.
      const words = item
        .toLowerCase()
        .split(/[^a-z0-9_.-]+/)
        .filter((word) => word.length > 4)
      const overlap = words.filter((word) => overview.includes(word)).length
      const covered = words.length > 0 && overlap / words.length >= 0.5
      if (!covered) missing.push({ label, item })
    }
  }

  // With inline suggestions present the author does get line-level feedback, so only
  // surface findings that look genuinely absent from everywhere.
  return has_inline ? missing.filter((entry) => entry.label === 'Blocker') : missing
}

function build_body({ review, model, head_sha, is_refresh, unapplyable, has_inline }) {
  const parts = [MARKER, review.overview_comment.trim()]

  const undelivered = find_undelivered_findings({ review, has_inline })
  if (undelivered.length) {
    parts.push(
      `**Also flagged:**\n${undelivered.map((entry) => `- *${entry.label}:* ${entry.item}`).join('\n')}`,
    )
  }

  // Suggestions that could not be anchored inline still get surfaced, just without
  // an Apply button (a suggestion block only becomes applyable as an inline review
  // comment on the exact lines it replaces).
  if (unapplyable?.length) {
    const rendered = unapplyable
      .map(
        (item) =>
          `**\`${item.path}\`**${item.line ? ` (around line ${item.line})` : ''}\n` +
          `${item.prose ? `${item.prose}\n` : ''}\n\`\`\`suggestion\n${item.suggestion}\n\`\`\``,
      )
      .join('\n\n')
    parts.push(
      `<details><summary>Suggested edits (couldn't be anchored inline — copy manually)</summary>\n\n${rendered}\n\n</details>`,
    )
  }

  const footer = [
    '---',
    `*Automated pre-review (${model}) against commit \`${head_sha.slice(0, 7)}\`. ` +
      'Advisory only — it can\'t approve, block, or merge, and a human maintainer still reviews this PR. ' +
      'Anything it flags may be wrong; push back freely.*',
  ]
  if (is_refresh) {
    footer.push(
      '*This comment was refreshed after a new push. Any inline suggestions from the first pass may now be stale.*',
    )
  }
  parts.push(footer.join('\n'))

  return parts.join('\n\n')
}

async function upsert_overview({ base_repo, pr_number, token, body, existing }) {
  const url = existing
    ? `${GITHUB_API}/repos/${base_repo}/issues/comments/${existing.id}`
    : `${GITHUB_API}/repos/${base_repo}/issues/${pr_number}/comments`
  const response = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: headers(token),
    body: JSON.stringify({ body }),
  })
  if (!response.ok) {
    throw new Error(`${existing ? 'Update' : 'Create'} comment failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

// Inline suggestions are posted once, on the first pass. Reviews can't be edited in
// place, so re-posting them on every push would stack duplicates.
async function post_inline_suggestions({ base_repo, pr_number, token, head_sha, suggestions }) {
  const comments = suggestions
    .filter((item) => item.path && Number.isInteger(item.line) && item.suggestion)
    .slice(0, 20)
    .map((item) => ({
      path: item.path,
      line: item.line,
      side: 'RIGHT',
      body: `${item.prose ? `${item.prose}\n\n` : ''}\`\`\`suggestion\n${item.suggestion}\n\`\`\``,
    }))

  if (!comments.length) return { posted: 0, rejected: [] }

  const response = await fetch(`${GITHUB_API}/repos/${base_repo}/pulls/${pr_number}/reviews`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ commit_id: head_sha, event: 'COMMENT', comments }),
  })

  if (response.ok) return { posted: comments.length, rejected: [] }

  // 422 means at least one line isn't part of the diff. Rather than dropping the
  // content, hand it back so it can ride along in the overview comment.
  const detail = await response.text()
  console.log(`Inline review rejected (${response.status}): ${detail.slice(0, 300)}`)
  return { posted: 0, rejected: suggestions }
}

// What a dry run prints, so the log matches what would actually be posted rather than
// just the model's raw prose.
export function preview_body({ review, model, head_sha, package_files = [], baseline_passed = false }) {
  const { kept } = screen_suggestions({
    suggestions: Array.isArray(review.inline_suggestions) ? review.inline_suggestions : [],
    package_files,
    baseline_passed,
  })
  return build_body({
    review,
    model,
    head_sha,
    is_refresh: false,
    unapplyable: [],
    has_inline: kept.length > 0,
  })
}

export async function post_review({
  base_repo,
  pr_number,
  token,
  head_sha,
  review,
  model,
  package_files = [],
  baseline_passed = false,
}) {
  const existing = await find_existing_comment({ base_repo, pr_number, token })
  const screened = screen_suggestions({
    suggestions: Array.isArray(review.inline_suggestions) ? review.inline_suggestions : [],
    package_files,
    baseline_passed,
  })
  for (const item of screened.rejected) {
    console.log(`  Dropped suggestion for ${item.path}:${item.line} — ${item.reason}`)
  }
  const suggestions = screened.kept

  let unapplyable = []
  if (!existing && suggestions.length) {
    const result = await post_inline_suggestions({
      base_repo,
      pr_number,
      token,
      head_sha,
      suggestions,
    })
    unapplyable = result.rejected
    console.log(`Inline suggestions posted: ${result.posted}`)
  } else if (existing && suggestions.length) {
    // Refresh pass: keep the content but don't stack another review.
    unapplyable = suggestions
  }

  const body = build_body({
    review,
    model,
    head_sha,
    is_refresh: Boolean(existing),
    unapplyable,
    // Suggestions that fell back into the body still count as delivered feedback.
    has_inline: suggestions.length > 0,
  })

  const comment = await upsert_overview({ base_repo, pr_number, token, body, existing })
  return { url: comment.html_url, updated: Boolean(existing) }
}

export default { post_review }
