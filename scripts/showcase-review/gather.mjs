// Evidence collection for the showcase auto-review.
//
// Everything here is READ-ONLY with respect to the contributor's PR: file contents
// are fetched as text through the GitHub API and never executed. The only thing
// written to disk is a copy of the PR's showcase package inside the base checkout,
// so the existing validator can be run against it.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'

const GITHUB_API = 'https://api.github.com'
const MAX_FILES = 60
const MAX_FILE_BYTES = 120_000
const URL_TIMEOUT_MS = 8000

// Text extensions worth showing the model. Anything else (images, zips) is listed
// by path only.
const TEXT_EXTENSIONS = new Set(['.json', '.md', '.txt', '.yml', '.yaml', '.toml'])

function github_headers(token, accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'showcase-auto-review',
  }
}

async function github_json(url, token) {
  const response = await fetch(url, { headers: github_headers(token) })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}: ${await response.text()}`)
  }
  return response.json()
}

// A PR path is only safe to write into the checkout if it stays inside it.
function is_safe_repo_path(file_path) {
  if (!file_path || path.isAbsolute(file_path)) return false
  return !file_path.split(/[\\/]/).includes('..')
}

export async function fetch_pr_meta({ base_repo, pr_number, token }) {
  const pr = await github_json(`${GITHUB_API}/repos/${base_repo}/pulls/${pr_number}`, token)
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    author: pr.user?.login ?? 'unknown',
    draft: pr.draft === true,
    head_ref: pr.head?.ref ?? '',
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
  }
}

export async function fetch_changed_files({ base_repo, pr_number, token }) {
  const files = []
  for (let page = 1; page <= 5; page += 1) {
    const batch = await github_json(
      `${GITHUB_API}/repos/${base_repo}/pulls/${pr_number}/files?per_page=100&page=${page}`,
      token,
    )
    files.push(...batch.map((file) => ({ path: file.filename, status: file.status })))
    if (batch.length < 100) break
  }
  return files
}

// Fetched as raw text and treated as untrusted data downstream.
async function fetch_blob({ head_repo, head_sha, file_path, token }) {
  const url = `${GITHUB_API}/repos/${head_repo}/contents/${encodeURI(file_path)}?ref=${head_sha}`
  const response = await fetch(url, { headers: github_headers(token, 'application/vnd.github.raw') })
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` }

  const text = await response.text()
  if (text.length > MAX_FILE_BYTES) {
    return { ok: true, truncated: true, text: text.slice(0, MAX_FILE_BYTES) }
  }
  return { ok: true, truncated: false, text }
}

export async function fetch_package_files({ head_repo, head_sha, token, changed_files }) {
  const candidates = changed_files
    .filter((file) => file.status !== 'removed')
    .filter((file) => is_safe_repo_path(file.path))
    .slice(0, MAX_FILES)

  const results = []
  for (const file of candidates) {
    const extension = path.extname(file.path).toLowerCase()
    if (!TEXT_EXTENSIONS.has(extension)) {
      results.push({ path: file.path, status: file.status, binary: true })
      continue
    }
    const blob = await fetch_blob({ head_repo, head_sha, file_path: file.path, token })
    results.push({
      path: file.path,
      status: file.status,
      binary: false,
      unavailable: blob.ok ? undefined : blob.reason,
      truncated: blob.truncated,
      text: blob.text,
    })
  }

  const dropped = changed_files.length - candidates.length
  return { files: results, dropped_count: dropped > 0 ? dropped : 0 }
}

// The manifest MUST live at showcase/<slug>/showcase.json. A manifest at the repo
// root passes CI without ever being checked and never publishes, so it is called
// out explicitly.
export function find_manifests(changed_files) {
  const in_showcase = []
  const misplaced = []
  for (const file of changed_files) {
    if (!file.path.endsWith('showcase.json')) continue
    if (/^showcase\/[^/]+\/showcase\.json$/.test(file.path)) {
      in_showcase.push(file.path)
    } else {
      misplaced.push(file.path)
    }
  }
  return { in_showcase, misplaced }
}

// Top-level directories referenced by any manifest's skills[].sourcePath, read from
// the manifests already staged in the sandbox (existing tree + the PR's own files).
function collect_source_path_roots(workspace) {
  const roots = new Set()
  const showcase_dir = path.join(workspace, 'showcase')
  if (!fs.existsSync(showcase_dir)) return roots

  const manifests = []
  for (const entry of fs.readdirSync(showcase_dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifest = path.join(showcase_dir, entry.name, 'showcase.json')
    if (fs.existsSync(manifest)) manifests.push(manifest)
  }

  for (const manifest of manifests) {
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    } catch {
      continue // a malformed manifest is the validator's finding to report, not ours
    }
    for (const skill of Array.isArray(parsed.skills) ? parsed.skills : []) {
      if (typeof skill?.sourcePath !== 'string' || !is_safe_repo_path(skill.sourcePath)) continue
      const [root] = skill.sourcePath.split('/')
      if (root) roots.add(root)
    }
  }
  return roots
}

// Run the repo's own validator over the PR's files, so the reported result is the
// one CI would produce. The PR's files are laid down in a throwaway copy of the
// repo rather than the checkout itself — that keeps a local dry run from dirtying
// the maintainer's working tree. Only JSON/markdown is read and written; nothing
// from the PR is executed.
export function run_validator({ package_files, repo_root }) {
  // realpath matters: on macOS os.tmpdir() is a symlink, so the path the validator
  // prints differs from the one we'd strip out of its error message.
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-review-')))

  try {
    fs.mkdirSync(path.join(workspace, 'scripts'), { recursive: true })
    fs.copyFileSync(
      path.join(repo_root, 'scripts/validate-showcase.mjs'),
      path.join(workspace, 'scripts/validate-showcase.mjs'),
    )
    // The validator checks every manifest (slug uniqueness across the whole tree,
    // and that each skills[].sourcePath contains a SKILL.md), so it needs the
    // existing showcase tree — but only the text files. showcase/ is ~170MB of
    // images and video; copying those would be pure waste.
    const copy_text_tree = (relative) => {
      const source = path.join(repo_root, relative)
      if (!fs.existsSync(source)) return
      fs.cpSync(source, path.join(workspace, relative), {
        recursive: true,
        filter: (entry) => {
          if (fs.statSync(entry).isDirectory()) return true
          const extension = path.extname(entry).toLowerCase()
          return extension === '.json' || extension === '.md'
        },
      })
    }

    copy_text_tree('showcase')

    const written = []
    for (const file of package_files) {
      if (file.binary || file.unavailable || typeof file.text !== 'string') continue
      if (!file.path.startsWith('showcase/') || !is_safe_repo_path(file.path)) continue
      const target = path.join(workspace, file.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, file.text)
      written.push(file.path)
    }

    // skills[].sourcePath is resolved from the REPO ROOT and doesn't have to live
    // under showcase/ — some manifests point at the top-level skills/ directory.
    // Miss those and the validator reports a bogus "must contain SKILL.md".
    for (const root of collect_source_path_roots(workspace)) {
      if (root !== 'showcase') copy_text_tree(root)
    }

    try {
      const stdout = execFileSync('node', ['scripts/validate-showcase.mjs'], {
        cwd: workspace,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { passed: true, output: stdout.trim(), files_written: written.length }
    } catch (error) {
      const raw = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() || String(error.message)
      // The validator throws, so stderr is a full stack trace. Keep just the message
      // line and make paths repo-relative — a stack trace is noise to the reviewer.
      const message = raw.split('\n').find((line) => line.startsWith('Error: '))
      const detail = (message ?? raw.split('\n').slice(0, 5).join('\n'))
        .replace(/^Error:\s*/, '')
        .split(`${workspace}/`)
        .join('')
      // The validator is fail-fast: this is the FIRST failure, not necessarily the only one.
      return { passed: false, output: detail, files_written: written.length }
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
}

export function extract_urls(package_files) {
  const urls = new Set()
  for (const file of package_files) {
    if (!file.path.endsWith('showcase.json') || typeof file.text !== 'string') continue
    for (const match of file.text.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
      urls.add(match[0].replace(/[.,]+$/, ''))
    }
  }
  return [...urls]
}

// A URL pointing at the base repo's main branch 404s until the PR merges — that's
// the documented convention, not a broken link. Pull the repo-relative path back out
// so it can be checked against the PR branch instead.
function parse_self_repo_url(url) {
  const blob = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|tree)\/(?:main|master)\/(.+?)\/?$/,
  )
  if (blob) return { path: decodeURIComponent(blob[3]) }
  const raw = url.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:main|master)\/(.+?)\/?$/,
  )
  if (raw) return { path: decodeURIComponent(raw[3]) }
  return null
}

// Known false negatives (documented in the rubric): X/DeFiLlama 403 to bots, MCP
// endpoints 405 to GET, paywalled routes 402. These are annotated, not reported as
// broken.
function classify_url_status(url, status) {
  if (status >= 200 && status < 400) return 'ok'
  if (status === 403 || status === 405 || status === 402) return 'likely-fine-verify-manually'
  if (status === 0) return 'unreachable-verify-manually'
  return 'broken'
}

export async function check_urls(urls, { head_repo, head_sha, token } = {}) {
  const checks = await Promise.all(
    urls.slice(0, 40).map(async (url) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), URL_TIMEOUT_MS)
      let status = 0
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'showcase-auto-review' },
        })
        status = response.status
      } catch {
        status = 0
      } finally {
        clearTimeout(timer)
      }

      // Resolve the until-merge case properly: does the file actually exist on the
      // PR branch? If not, the href is stale — a real finding, not a false negative.
      const self_ref = status === 404 ? parse_self_repo_url(url) : null
      if (self_ref && head_repo && head_sha && token) {
        const exists = await fetch(
          `${GITHUB_API}/repos/${head_repo}/contents/${encodeURI(self_ref.path)}?ref=${head_sha}`,
          { method: 'HEAD', headers: github_headers(token) },
        )
          .then((response) => response.ok)
          .catch(() => null)

        if (exists === true) return { url, status, verdict: 'ok-on-pr-branch-404s-until-merge' }
        if (exists === false) {
          return { url, status, verdict: 'MISSING-on-pr-branch-too (stale link)' }
        }
      }

      return { url, status, verdict: classify_url_status(url, status) }
    }),
  )
  return checks
}

export function scan_for_secrets(package_files) {
  const patterns = [
    ['raw private key', /0x[a-fA-F0-9]{64}/],
    ['PRIVATE_KEY assignment', /PRIVATE_KEY\s*[=:]\s*\S+/],
    ['mnemonic', /\bmnemonic\b\s*[=:]/i],
  ]
  const hits = []
  for (const file of package_files) {
    if (typeof file.text !== 'string') continue
    for (const [label, pattern] of patterns) {
      if (pattern.test(file.text)) hits.push({ path: file.path, kind: label })
    }
  }
  return hits
}

export async function gather_evidence({ base_repo, head_repo, head_sha, pr_number, token, repo_root }) {
  // Without a head sha every blob fetch 404s, and the run would otherwise sail on to
  // report a passing validator having read none of the PR's files. Fail loudly.
  if (!head_sha) throw new Error('head_sha is required — refusing to review without the PR head commit')

  const meta = await fetch_pr_meta({ base_repo, pr_number, token })
  const changed_files = await fetch_changed_files({ base_repo, pr_number, token })
  const { files: package_files, dropped_count } = await fetch_package_files({
    head_repo: head_repo || base_repo,
    head_sha,
    token,
    changed_files,
  })

  // Same class of silent failure: a deleted fork, a force-push, or a bad token can
  // make every file unreadable. Reviewing nothing is worse than not reviewing.
  const text_candidates = package_files.filter((file) => !file.binary)
  const unreadable = text_candidates.filter((file) => file.unavailable)
  if (text_candidates.length > 0 && unreadable.length === text_candidates.length) {
    throw new Error(
      `Could not read any of the ${text_candidates.length} text file(s) at ${head_repo || base_repo}@${head_sha.slice(0, 7)} ` +
        `(first reason: ${unreadable[0].unavailable}). The fork may be deleted or force-pushed.`,
    )
  }

  const manifests = find_manifests(changed_files)
  const validator = run_validator({ package_files, repo_root })
  const url_checks = await check_urls(extract_urls(package_files), {
    head_repo: head_repo || base_repo,
    head_sha,
    token,
  })
  const secret_hits = scan_for_secrets(package_files)

  if (dropped_count > 0) {
    console.log(`Note: ${dropped_count} changed file(s) beyond the ${MAX_FILES}-file cap were not read.`)
  }

  return {
    meta,
    changed_files,
    package_files,
    manifests,
    validator,
    url_checks,
    secret_hits,
    dropped_count,
  }
}

export default { gather_evidence }
