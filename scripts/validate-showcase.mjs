#!/usr/bin/env node

// Validates showcase manifests against the shape documented in
// showcase/README.md. MAINTAINERS: if you add, remove, or change a rule here,
// update the "Field Reference" table and the "Maintainers" section in
// showcase/README.md in the same PR so the docs stay the source of truth.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const showcaseDir = path.join(repoRoot, 'showcase')
const primitives = new Set(['wallet', 'email', 'card', 'token', 'acp'])
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const httpPattern = /^https?:\/\//
const videoPageHostPattern =
  /(?:^|\.)(?:youtube\.com|youtu\.be|x\.com|twitter\.com|vimeo\.com|tiktok\.com|loom\.com|github\.com)$/i
const sharePreviewHostPattern =
  /(?:^|\.)(?:dropbox\.com|drive\.google\.com|docs\.google\.com|1drv\.ms|onedrive\.live\.com|mega\.nz|mediafire\.com|wetransfer\.com)$/i
const videoFilePattern = /\.(?:mp4|webm|mov|m4v)$/i
// host pattern -> keyword the videoLabel must contain for that platform
const platformLabelRules = [
  [/(?:^|\.)(?:youtube\.com|youtu\.be)$/i, /youtube/i, 'YouTube'],
  [/(?:^|\.)(?:x\.com|twitter\.com)$/i, /\bX\b|twitter|\u{1D54F}/iu, 'X'],
  [/(?:^|\.)vimeo\.com$/i, /vimeo/i, 'Vimeo'],
  [/(?:^|\.)tiktok\.com$/i, /tiktok/i, 'TikTok'],
  [/(?:^|\.)loom\.com$/i, /loom/i, 'Loom'],
]

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return ''
  }
}

function pathOf(url) {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return ''
  }
}

function fail(message) {
  throw new Error(message)
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireString(project, key, label = key) {
  if (typeof project[key] !== 'string' || project[key].trim() === '') {
    fail(`${label} must be a non-empty string`)
  }
}

function requireUrl(value, label) {
  if (typeof value !== 'string' || !httpPattern.test(value)) {
    fail(`${label} must be an http(s) URL`)
  }
}

function requireSafeRelativePath(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty relative path`)
  }
  if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    fail(`${label} must stay inside the repository`)
  }
}

function collectManifestFiles() {
  if (!fs.existsSync(showcaseDir)) {
    fail(`Missing showcase directory: ${showcaseDir}`)
  }

  const files = []
  const legacyDir = path.join(showcaseDir, 'projects')

  if (fs.existsSync(legacyDir)) {
    for (const file of fs.readdirSync(legacyDir)) {
      if (file.endsWith('.json')) {
        files.push(path.join(legacyDir, file))
      }
    }
  }

  for (const entry of fs.readdirSync(showcaseDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'projects' || entry.name.startsWith('.')) {
      continue
    }

    const manifestFile = path.join(showcaseDir, entry.name, 'showcase.json')
    if (fs.existsSync(manifestFile)) {
      files.push(manifestFile)
    }
  }

  return files.sort()
}

function validateProject(project, file) {
  if (!isObject(project)) fail(`${file} must contain a JSON object`)

  if (project.hidden !== undefined && typeof project.hidden !== 'boolean') {
    fail(`${file}: hidden must be a boolean`)
  }

  for (const key of ['slug', 'title', 'tagline', 'description', 'status', 'topic']) {
    requireString(project, key)
  }

  if (!slugPattern.test(project.slug)) {
    fail(`${file}: slug must be lowercase kebab-case`)
  }

  if (path.basename(file) === 'showcase.json') {
    const packageSlug = path.basename(path.dirname(file))
    if (packageSlug !== project.slug) {
      fail(`${file}: parent folder must match slug ${project.slug}`)
    }
  } else if (path.basename(file) !== `${project.slug}.json`) {
    fail(`${file}: filename must be ${project.slug}.json`)
  }

  if (!Array.isArray(project.topics) || project.topics.length === 0) {
    fail(`${file}: topics must be a non-empty array`)
  }
  for (const topic of project.topics) {
    if (typeof topic !== 'string' || topic.trim() === '') {
      fail(`${file}: every topic must be a non-empty string`)
    }
  }

  if (!isObject(project.builder)) fail(`${file}: builder is required`)
  requireString(project.builder, 'name', `${file}: builder.name`)
  requireUrl(project.builder.url, `${file}: builder.url`)

  if (!isObject(project.links)) fail(`${file}: links is required`)
  for (const key of ['repo', 'share', 'feedback']) {
    requireUrl(project.links[key], `${file}: links.${key}`)
  }
  for (const key of ['demo', 'video']) {
    if (project.links[key] !== undefined) {
      requireUrl(project.links[key], `${file}: links.${key}`)
    }
  }

  if (!Array.isArray(project.primitives) || project.primitives.length === 0) {
    fail(`${file}: primitives must be a non-empty array`)
  }
  for (const primitive of project.primitives) {
    if (!primitives.has(primitive)) {
      fail(`${file}: unsupported primitive ${primitive}`)
    }
  }

  if (!isObject(project.visual)) fail(`${file}: visual is required`)
  for (const key of ['kind', 'eyebrow', 'title']) {
    requireString(project.visual, key, `${file}: visual.${key}`)
  }
  if (project.visual.videoUrl !== undefined) {
    requireUrl(project.visual.videoUrl, `${file}: visual.videoUrl`)
    const videoHost = hostOf(project.visual.videoUrl)
    if (videoPageHostPattern.test(videoHost)) {
      fail(
        `${file}: visual.videoUrl must be a direct video file, not a video or repo page. ` +
          'Put the page URL in links.video instead, then either omit visual.videoUrl ' +
          '(YouTube, Vimeo, TikTok, Loom) or use the direct file URL ' +
          '(X posts: video.twimg.com; GitHub repo files: raw.githubusercontent.com). ' +
          'See showcase/README.md "Video Fields".',
      )
    }
    if (sharePreviewHostPattern.test(videoHost)) {
      fail(
        `${file}: visual.videoUrl is a share/preview page that cannot stream inline. ` +
          'Use a direct file host instead (for Dropbox: dl.dropboxusercontent.com; ' +
          'otherwise a CDN, object storage, or raw.githubusercontent.com). ' +
          'See showcase/README.md "Video Fields".',
      )
    }
    if (!videoFilePattern.test(pathOf(project.visual.videoUrl))) {
      fail(
        `${file}: visual.videoUrl must point to a .mp4, .webm, .mov, or .m4v file ` +
          'so the docs site can play it inline. See showcase/README.md "Video Fields".',
      )
    }
  }
  if (project.visual.posterUrl !== undefined) {
    const poster = project.visual.posterUrl
    const isSiteRelative =
      typeof poster === 'string' && poster.startsWith('/') && !poster.startsWith('//')
    if (!isSiteRelative) {
      requireUrl(poster, `${file}: visual.posterUrl`)
    }
  }
  if (project.visual.videoLabel !== undefined) {
    requireString(project.visual, 'videoLabel', `${file}: visual.videoLabel`)
  }
  if (project.links.video !== undefined) {
    requireString(
      project.visual,
      'videoLabel',
      `${file}: visual.videoLabel (required when links.video is set; it becomes the watch button text)`,
    )
    const videoHost = hostOf(project.links.video)
    for (const [hostPattern, labelPattern, platformName] of platformLabelRules) {
      if (hostPattern.test(videoHost) && !labelPattern.test(project.visual.videoLabel)) {
        fail(
          `${file}: visual.videoLabel must mention ${platformName} when links.video points there, ` +
            `for example "Watch the 1:50 demo on ${platformName}"`,
        )
      }
    }
  }

  if (!Array.isArray(project.skills)) fail(`${file}: skills must be an array`)
  for (const [index, skill] of project.skills.entries()) {
    if (!isObject(skill)) fail(`${file}: skills[${index}] must be an object`)
    for (const key of ['name', 'href', 'summary', 'install']) {
      requireString(skill, key, `${file}: skills[${index}].${key}`)
    }
    requireUrl(skill.href, `${file}: skills[${index}].href`)
    if (skill.sourcePath !== undefined) {
      requireSafeRelativePath(skill.sourcePath, `${file}: skills[${index}].sourcePath`)
      const skillSource = path.join(repoRoot, skill.sourcePath)
      if (!fs.existsSync(path.join(skillSource, 'SKILL.md'))) {
        fail(`${file}: skills[${index}].sourcePath must contain SKILL.md`)
      }
    }
  }

  if (!Array.isArray(project.artifacts) || project.artifacts.length === 0) {
    fail(`${file}: artifacts must be a non-empty array`)
  }
  for (const [index, artifact] of project.artifacts.entries()) {
    if (!isObject(artifact)) fail(`${file}: artifacts[${index}] must be an object`)
    for (const key of ['label', 'href', 'kind']) {
      requireString(artifact, key, `${file}: artifacts[${index}].${key}`)
    }
    requireUrl(artifact.href, `${file}: artifacts[${index}].href`)
  }

  if (project.soul !== undefined) {
    if (!isObject(project.soul)) fail(`${file}: soul must be an object`)
    requireUrl(project.soul.href, `${file}: soul.href`)
    requireString(project.soul, 'summary', `${file}: soul.summary`)
  }

  if (!Array.isArray(project.feedbackPrompts) || project.feedbackPrompts.length !== 3) {
    fail(`${file}: feedbackPrompts must contain exactly three prompts`)
  }
  for (const [index, prompt] of project.feedbackPrompts.entries()) {
    if (typeof prompt !== 'string' || prompt.trim() === '') {
      fail(`${file}: feedbackPrompts[${index}] must be a non-empty string`)
    }
  }
}

const files = collectManifestFiles()

if (files.length === 0) {
  fail('No showcase project manifests found')
}

const seenSlugs = new Set()

for (const filePath of files) {
  const project = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  validateProject(project, filePath)
  if (seenSlugs.has(project.slug)) {
    fail(`Duplicate showcase slug: ${project.slug}`)
  }
  seenSlugs.add(project.slug)
}

console.log(`Validated ${files.length} showcase project manifest(s).`)
