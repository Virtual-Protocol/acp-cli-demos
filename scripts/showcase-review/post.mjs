// Output layer: posts the draft review as ONE advisory comment, idempotently.
//
// Deliberately limited: event is always COMMENT. This never approves, never
// requests changes, and never merges.

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
export function preview_body({ review, model, head_sha }) {
  const suggestions = Array.isArray(review.inline_suggestions) ? review.inline_suggestions : []
  return build_body({
    review,
    model,
    head_sha,
    is_refresh: false,
    unapplyable: [],
    has_inline: suggestions.length > 0,
  })
}

export async function post_review({ base_repo, pr_number, token, head_sha, review, model }) {
  const existing = await find_existing_comment({ base_repo, pr_number, token })
  const suggestions = Array.isArray(review.inline_suggestions) ? review.inline_suggestions : []

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
