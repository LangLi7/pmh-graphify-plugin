---
description: "Graphify plugin for the DeepSeek Harness: an interactive code graph in three levels, node search, a code viewer, and a self-installing CLI."
kind: "plugin"
---

# dsh-plugin-graphify

English | [Deutsch](README.de.md)

**Graphify as a plugin for the DeepSeek Harness.** A sidebar entry, a drawn code
graph in three levels, node search, hubs, a code viewer — and a CLI that
installs itself on first start when it is missing.

![The whole graph as a map](docs/vorschau-gesamt.png)

*Preview with sample data (a host-free inspection page), not the graph of a real
repository.*

## What it shows

- **Three levels**, switchable in the toolbar:
  - **Overview** — a sample across the 16 largest groups; per group the
    selection grows from its most important node, so coloured islands emerge
  - **Group** — every node of one group
  - **Neighbourhood** — the surroundings of one node, depth 1–3
- **Canvas graph** with a force layout: the wheel zooms around the pointer,
  dragging moves nodes and the canvas, `⤢` fits, “Arrange” restarts
- **Search** across name, kind and path; **largest hubs** as quick picks
- **Node data**: kind, path, group, links; neighbours are clickable
- **Code viewer** with line numbers and syntax colours; **Edit** with `Ctrl+S`,
  a prompt when changes are unsaved
- **Build graph** runs `graphify extract` through the host route
- **Self-install**: when the CLI is missing, it is pulled in via `uv`, `pipx` or
  `pip` — see below

## Installation

Requirements: a DeepSeek Harness with the web interface and Bun. For the CLI
self-install, additionally `uv`, `pipx` or Python (optional).

```powershell
git clone https://github.com/LangLi7/dsh-plugin-graphify.git
cd dsh-plugin-graphify
bun run build      # optional — lib/ is shipped
```

Then install the folder `dsh-plugin-graphify` in the **plugin manager** (entry
`pmh-graphify`) and restart the host once. The package is **bundle and plugin in
one**: `dsh.bundle.patch` registers the host half, `dsh.client` the browser half.
It has no workspace dependencies; the host half is bundled, the browser half
ships as a finished module.

After the restart, **Graphify** sits in the sidebar. If there is no graph yet,
the **Build graph** button runs the first pass.

## Graphify comes along

On start, the plugin checks whether the CLI is reachable — under `command`, in
`PATH`, and at the known `uv` locations. If it is missing and `setup` is `auto`
(the default), the provider installs it **once** in the background:

| Order | Detected by | Command |
|---|---|---|
| 1 | `uv` | `uv tool install graphifyy` |
| 2 | `pipx` | `pipx install graphifyy` |
| 3 | `python`/`python3`/`py` | `python -m pip install --user graphifyy` |

On success, the resolved path is stored as `command`. If no package manager is
present, nothing automatic happens; the panel shows the instructions for the
respective platform.

![Setup box when the CLI is missing](docs/vorschau-einrichtung.png)

When the CLI is missing, the panel shows a box with the route, **Install now**,
the output, and the “Install automatically at start” switch. To turn it off:

```json
// $DSH_HOME/world/graphify.json
{ "command": "graphify", "outDir": "graphify-out", "root": ".", "setup": "never" }
```

`setup` accepts `auto`, `ask` and `never`. Only the PyPI package `graphifyy` is
installed; no `sudo`, no `curl | sh`, no installer download, and a timeout after
five minutes.

The **MCP server** remains a separate profile entry — it is machine-specific and
does not belong in a plugin:

```yaml
- insert:
    - id: graphify-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: graphify
        transport: stdio
        command: 'C:\Users\Chang\.local\bin\graphify-mcp.exe'
        args: ['--graph', 'C:\Users\Chang\prometheus-harness\graphify-out\graph.json']
        env: {}
        cwd: 'C:\Users\Chang\prometheus-harness'
```

## Settings

Plugin settings → Graphify:

| Field | Values | Default | Effect |
|---|---|---|---|
| `surface` | `sidebar` · `plugins` · `both` · `none` | `sidebar` | where the plugin appears |
| `order` | number | `12` | position in the sidebar or list |
| `label` | text | empty | custom label |
| `view` | `split` · `graph` · `list` | `split` | which panes open |
| `level` | `gesamt` · `gruppe` · `nachbarschaft` | `gesamt` | level on open |
| `depth` | `1`–`3` | `2` | neighbourhood steps |
| `limit` | `20`–`400` | `160` | maximum nodes drawn |
| `labels` | `true`/`false` | `true` | names on the nodes |
| `colour` | `community` · `kind` | `community` | colour by group or by kind |
| `motion` | `true`/`false` | `true` | keep computing the layout when touched |
| `inspector` | `right` · `below` · `off` | `right` | where the node data goes |

## Routes

All routes live under `/api/world/graphify` and answer **only** loopback
requests.

| Path | Method | Response |
|---|---|---|
| `/status` | GET | CLI, output dir, nodes/edges |
| `/graph` | GET | the graph in world form |
| `/run` | POST | run `{ mode: "deep" \| "update" }` |
| `/config` | GET/POST | `{ command, outDir, root, setup }` |
| `/setup` | GET | CLI, uv, pipx, Python, route, last attempt |
| `/setup` | POST | install `{ method: "uv" \| "pipx" \| "pip" }` |
| `/file?path=…` | GET | `{ path, content, language, lines }` of a text file |
| `/file` | POST | save `{ path, content }` |

## Layout

```
src/host/     provider: routes, configuration, self-install, mapping
src/client/   panel, canvas, force layout, texts (de/en)
lib/          built halves (index.js, client.js)
build.mjs     builds both halves
```

The host half is bundled and imports only `@deepseek-ai/schemastery`. The
browser half loads React externally and brings its own texts; if the `graphify`
namespace is already owned by a language pack, that pack's texts stay in charge.

## Limits

- **Overview** is a sample (16 groups, default 160 nodes), not the whole graph:
  36,000 nodes are not a picture. Search and hubs lead through the rest.
- **Group** shows at most `limit` nodes of the group, by degree.
- The layout runs in the browser; 400 nodes are still fluid, beyond that it is
  truncated.
- The file route reads the whole graph per request (~0.5 s locally at 21 MB).

## Provenance

Extracted from [`LangLi7/prometheus-harness`](https://github.com/LangLi7/prometheus-harness),
as of **2026-10-21** (`packages/plugin/graphify` and
`packages/world/graphify`). There the plugin runs alongside the language pack;
this copy is built standalone.

## Licence

No licence chosen yet. Anyone reusing the repository should pick one first (MIT,
for example); until then, copyright applies.
