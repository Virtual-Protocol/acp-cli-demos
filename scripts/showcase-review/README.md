# Showcase PR auto-review

Advisory pre-review for `showcase/<slug>/` contribution PRs. It posts one comment so
a human maintainer starts from a first pass instead of a blank page.

**It cannot approve, request changes, or merge.** Everything it says is advisory and
may be wrong.

## How it runs

`.github/workflows/showcase-pr-review.yml` fires on `pull_request_target`
(`opened`, `synchronize`, `reopened`) filtered to `showcase/**`. There is no label or
comment gate — every PR touching `showcase/**` gets reviewed.

Two things decide whether a comment actually gets posted:

1. a structural check — the PR must touch `showcase/`;
2. the model's own `is_showcase_contribution` call, which filters out e.g. a
   maintainer editing showcase tooling rather than adding a package.

## Pipeline

| Stage | File | What it does |
| --- | --- | --- |
| Gather | `gather.mjs` | PR metadata, changed files, PR-head file contents, validator run, URL checks, secret scan |
| Judge | `gemini.mjs` | Sends evidence + the review rubric to Gemini, gets structured JSON back |
| Post | `post.mjs` | Upserts one comment; posts inline `suggestion` blocks on the first pass |
| Orchestrate | `run.mjs` | Wires the three together, short-circuits when there's nothing to review |

The deterministic work happens first on purpose: the model reasons over real
validator output and real HTTP statuses instead of guessing at them.

## Required secrets

| Secret | Why |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API key (model pinned to `gemini-2.5-pro` in the workflow) |
| `DEVREL_SKILL_TOKEN` | Fine-grained **read-only** PAT with Contents: Read on `game-by-virtuals/devrel` — the review rubric lives there and that repo is private |

`GITHUB_TOKEN` is provided by Actions; the workflow grants it `pull-requests: write`
so it can post the comment.

If `DEVREL_SKILL_TOKEN` is missing or expired the run fails loudly rather than
reviewing against no rubric. **The PAT expiring is the most likely way this breaks.**

## Security model

`pull_request_target` is used so fork PRs still get a review (a fork PR on the plain
`pull_request` event gets a read-only token and no secrets). That trigger runs with
secrets and write access, so:

- the workflow checks out the **base** commit, never `head.sha`;
- no file from the PR is ever executed — contributor files are fetched as text
  through the API and only read;
- the validator runs in a throwaway temp copy of the repo, so a local dry run can't
  dirty your working tree either;
- contributor file contents go into the prompt as explicitly-delimited untrusted
  data, and the model gets no tools and no shell. The worst case for a prompt
  injection attempt is a badly worded comment — not code execution or a merge.

Because the workflow always runs from the base branch, a PR editing these files
cannot change how its own review behaves.

## Local dry run

Prints the comment instead of posting it:

```bash
GEMINI_API_KEY=... \
GITHUB_TOKEN=$(gh auth token) \
RUBRIC_PATH=/path/to/devrel/skills/review-showcase-pr/SKILL.md \
BASE_REPO=Virtual-Protocol/acp-cli-demos \
PR_NUMBER=97 \
HEAD_REPO=$(gh pr view 97 --json headRepositoryOwner,headRepository \
  --jq '.headRepositoryOwner.login + "/" + .headRepository.name') \
HEAD_SHA=$(gh pr view 97 --json headRefOid --jq .headRefOid) \
DRY_RUN=1 node scripts/showcase-review/run.mjs
```

## Known limits

- **The validator is fail-fast**, so a failing PR shows only its *first* problem. The
  evidence says so; the review shouldn't imply the list is complete.
- **Inline suggestions are posted once**, on the first pass. Reviews can't be edited
  in place, so re-posting them per push would stack duplicates — later passes refresh
  the overview comment and fold the suggestions into a collapsed section instead.
- Caps: 60 files read, 120KB per file, 40 URLs checked. Anything dropped is logged.
- Runs on every push to a showcase PR. The comment is updated in place rather than
  duplicated, but each push does spend an API call.
