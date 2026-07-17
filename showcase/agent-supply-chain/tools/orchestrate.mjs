#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function main() {
  const [requestPath, providersPath, outputPath] = process.argv.slice(2)

  if (!requestPath || !providersPath) {
    console.error('Usage: node tools/orchestrate.mjs <request.json> <providers.json> [output.json]')
    process.exit(1)
  }

  const request = readJson(requestPath)
  const providers = readJson(providersPath)
  const decomposition = decomposeRequest(request)
  const ranking = rankProviders(decomposition, providers)
  const bundle = buildBundle(request, decomposition, ranking)

  const json = JSON.stringify(bundle, null, 2) + '\n'
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, json)
  } else {
    process.stdout.write(json)
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function decomposeRequest(request) {
  const text = `${request.title || ''} ${request.summary || ''} ${request.goal || ''}`.toLowerCase()
  const subtasks = [
    { id: 'architecture', label: 'Architecture note', match: ['architecture', 'workflow', 'flow'] },
    { id: 'skill', label: 'Skill contract', match: ['skill', 'runbook', 'contract'] },
    { id: 'proof', label: 'Proof bundle', match: ['proof', 'receipt', 'artifact', 'transcript'] },
    { id: 'manifest', label: 'Manifest package', match: ['manifest', 'readme', 'docs', 'publish'] },
  ]

  return subtasks
    .filter((subtask) => subtask.match.some((token) => text.includes(token.toLowerCase())))
    .map((subtask, index) => ({
      ...subtask,
      index: index + 1,
      acceptanceCriteria: ['Clear output contract', 'Inspectable evidence', 'Explicit approval gate'],
    }))
}

function rankProviders(decomposition, providers) {
  const catalog = Array.isArray(providers.providers) ? providers.providers : providers

  return decomposition.map((subtask) => {
    const scored = catalog.map((provider) => {
      const capabilities = Array.isArray(provider.capabilities) ? provider.capabilities : []
      const evidence = Number(provider.evidenceScore || 0)
      const budget = Number(provider.budgetFit || 0)
      const turnaround = Number(provider.turnaroundFit || 0)
      const capabilityMatch = capabilities.some((item) => subtask.id === item || subtask.label.toLowerCase().includes(String(item).toLowerCase())) ? 40 : 18
      const score = capabilityMatch + evidence + budget + turnaround

      return {
        provider: provider.name,
        score,
        rationale: provider.rationale || 'Matched from published capability metadata.',
      }
    })

    scored.sort((left, right) => right.score - left.score)

    return {
      subtask: subtask.label,
      topProviders: scored.slice(0, 3),
      selected: scored[0] || null,
      approvalRequired: true,
    }
  })
}

function buildBundle(request, decomposition, ranking) {
  return {
    request,
    decomposition,
    ranking,
    approvals: decomposition.map((subtask) => ({
      subtask: subtask.label,
      approved: false,
      approvedBy: null,
    })),
    receipts: [],
    status: 'planning_only',
    notes: [
      'This helper produces a deterministic orchestration plan.',
      'Live ACP job creation and settlement still require configured provider credentials.',
    ],
  }
}

main()
