# MON -- Website Reconstruction Engine

MON is a modular Python framework for inspecting websites: crawling a
domain, extracting frontend structure, reverse-engineering backend API
calls from JavaScript, live-verifying those endpoints against the real
server, and exporting everything as a structured, documented,
machine-readable specification -- e.g. for feeding into an AI agent, or for
saving a local clone of the site.

Network access (every `GET`/`POST` MON makes to the target site) uses a
deliberately simple, single-request-at-a-time fetcher: a plain
`requests.get`/`requests.post` per call, a mobile Chrome `User-Agent`, and
a bare timeout -- no shared session, no cookie jar, no automatic retries.
This is intentional: it's what makes MON reliable against sites that behave
oddly with persistent sessions or aggressive retry logic.

## Install

```bash
pip install -r requirements.txt
```

## Usage

MON exposes exactly one public function.

```python
from mon import inspect

result = inspect(
    domain="example.com",
)

print(result.pages_crawled)
print(result.routes)
print(result.api_spec)
print(result.explorer)
print(result.explorer_visual)
```

### `inspect()` parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `domain` | `str` | *required* | Target domain, with or without a scheme (`example.com` or `https://example.com` both work). |
| `action` | `str \| list[str]` | `"all_data"` | One action name or a list of them. See **Actions** below. |
| `profile` | `str` | `"balanced"` | `"fast"`, `"balanced"`, or `"deep"` -- controls crawl depth and whether API endpoints get live-verified. See **Profiles** below. |
| `max_page` | `int \| "all"` | `"all"` | Max number of pages to crawl. `"all"` defers to the profile's own limit. Pass an `int` to override it directly. |
| `output_dir` | `str \| Path` | `"./data"` | Base directory where output is written. |
| `project_name` | `str \| None` | `None` | Subfolder name under `output_dir`. Defaults to the domain name; if that folder already exists, MON appends `_2`, `_3`, etc. so nothing is overwritten. |
| `output_format` | `str` | `"json"` | Format of the final summary report: `"json"` or `"markdown"`. |
| `response` | `bool` | `True` | Whether to print live progress to the console (`[+] Launching...`, `[📥 FETCHING]`, `[✔ DONE]`, etc.). Set `False` for silent runs. |
| `timeout` | `int` | `10` | Per-request timeout, in seconds, for every fetch. |
| `save` | `bool` | `True` | Whether to write anything to disk at all. Set `False` to only get the in-memory `InspectResult` back. |
| `verify_live_apis` | `bool` | `True` | Whether to send a real request to each reconstructed API endpoint to confirm it responds. Only takes effect if the chosen `profile` also enables live verification (see below). |

### Profiles

| Profile | Max pages | Live-verifies APIs? | When to use it |
|---|---|---|---|
| `fast` | 15 | No | Quick look at a site's shape without hammering its API. |
| `balanced` | 100 | Yes | Default. Good mix of coverage and speed. |
| `deep` | 500 | Yes | Large sites, or when you need the most complete route/API map possible. |

## Architecture

```
User -> inspect() -> SDK -> Inspector -> Resolver -> Dispatcher -> Analyzers -> Context -> Output Writer -> InspectResult
```

- **SDK** (`mon/sdk.py`) -- the only public entry point. Builds an
  `InspectConfig`, calls the Inspector, returns an `InspectResult`.
- **Config** (`mon/config.py`) -- validates every argument to `inspect()`
  once, up front, into one immutable `InspectConfig` object that gets
  threaded through the whole run.
- **Inspector** (`mon/engine/inspector.py`) -- orchestrates the run. Knows
  nothing about HTML/JS/APIs itself.
- **Resolver** (`mon/engine/resolver.py`) -- expands composite actions
  (e.g. `api_spec`) into their leaf actions and topologically sorts
  analyzers by declared dependencies, so `crawler` always runs before
  `html`/`javascript`, which always run before `api`.
- **Registry** (`mon/engine/registry.py`) -- maps action names to analyzer
  classes. Adding a new analyzer never requires touching the Dispatcher.
- **Dispatcher** (`mon/engine/dispatcher.py`) -- executes the resolved
  pipeline against one shared `InspectContext`. If one analyzer fails, the
  rest still run -- the failure is recorded as a warning, not a crash.
- **Context** (`mon/engine/context.py`) -- the only channel analyzers use to
  communicate (crawled pages, discovered links, reconstructed endpoints,
  routes...). No analyzer ever imports or calls another analyzer directly.
- **Events** (`mon/engine/events.py`) -- analyzers never call `print()`
  directly; they emit events (page fetched, page skipped, analyzer
  started/finished/failed), and `ProgressManager`
  (`mon/engine/progress.py`) subscribes to turn those into the console log
  you see when `response=True`.
- **Fetcher** (`mon/network/fetcher.py`) -- the actual network layer. One
  `Fetcher` instance per run, shared by every analyzer that needs to talk
  to the target site.
- **Analyzers** (`mon/analyzers/`) -- one class per file, one responsibility
  each: `crawler`, `html`, `javascript`, `api`, `routes`, `assets`,
  `explorer`.
- **Parsers** (`mon/parsers/`) -- the actual link-extraction and
  JS-static-analysis logic the analyzers call into.
- **Output Writer** (`mon/engine/output_writer.py`) -- saves the crawled
  pages to disk as a local clone, plus `api_spec.json`, `explorer.json`,
  `explorer_visual.txt`, and the final summary report.
- **Exporters** (`mon/exporters/`) -- turn an `InspectResult` into the
  final summary report, `json` or `markdown`.

## Actions

Leaf actions (each maps to exactly one analyzer):

| Action | What it does |
|---|---|
| `crawler` | Breadth-first crawl of the domain. Fetches every same-domain page it can reach, starting from `/`. Everything else depends on this. |
| `html` | Extracts the `<title>` from every crawled HTML page. |
| `javascript` | Statically analyzes every crawled `.js` file to reconstruct backend API calls (`fetch`/`apiCall` sites, guessed payload keys, response-reading keys). |
| `api` | Turns the raw JS findings into `Endpoint` objects, each with a confidence score, and -- if the profile allows it -- live-verifies each one against the real server. |
| `routes` | Builds the combined route map: every frontend page plus every reconstructed API endpoint. |
| `assets` | Tallies the static assets (CSS, images, fonts, etc.) picked up during the crawl. |
| `explorer` | Builds `explorer.json` and the ASCII `explorer_visual.txt` tree, combining frontend routes and the "simulated backend API" tree. |

Composite actions (expand into a group of leaf actions):

| Action | Expands to |
|---|---|
| `all_data` | Every leaf action. |
| `api_spec` | `crawler`, `html`, `javascript`, `api` -- just the API reconstruction, no route map or explorer. |
| `explorer_visual` | `crawler`, `html`, `routes`, `explorer` -- just the site map, no API work. |
| `cloning` | `crawler`, `html`, `assets` -- just pull down a local copy of the site. |

## InspectResult

What `inspect()` returns:

| Field | Type | Description |
|---|---|---|
| `domain` | `str` | The domain that was inspected. |
| `actions_run` | `tuple[str, ...]` | Which leaf actions actually executed. |
| `pages_crawled` | `int` | Total pages successfully fetched. |
| `api_spec` | `dict` | `{endpoint_url: {...}}` -- method, purpose, guessed payload keys, response schema, confidence score/reasons, and (if live-verified) a real response sample. |
| `routes` | `list[Route]` | Every frontend page and backend endpoint discovered. |
| `explorer` | `dict` | The structured route tree, same shape as `explorer.json`. |
| `explorer_visual` | `str` | The ASCII tree view, same content as `explorer_visual.txt`. |
| `assets_saved` | `int` | Count of static assets found. |
| `warnings` | `list[str]` | Anything that went wrong along the way (a failed analyzer, a skipped page) without aborting the whole run. |

## Confidence scoring

Every reconstructed API endpoint in `api_spec` carries a `confidence.score`
(0-100) and `confidence.reasons` -- a list of exactly why MON believes the
endpoint is real (e.g. *"Discovered via static JS analysis"*, *"Payload
keys matched from FormData/JSON body"*, *"Live-verified against server"*).
Nothing is asserted without a reason.

## Output on disk

When `save=True` (the default), a run against `example.com` produces:

```
data/example.com/
    clone/                       raw fetched pages, laid out like the live site
    api_spec.json
    explorer.json
    explorer_visual.txt
    example.com_full_report.json  (or .md, if output_format="markdown")
```

## License

MIT -- see `LICENSE`.
