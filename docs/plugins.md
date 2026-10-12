# Plugins

> **Status: design proposal** (milestone *Extensions*). Nothing here is built yet.
> This page is the plan of record while the feature is built, and becomes the
> user-facing reference once phase 1 ships - it is deliberately not in the
> README table of contents until then.

Plugins let anyone add a feature to Grimoire - a page, a button on a token, an
importer, a background job, a REST endpoint - without it being part of the core
app or waiting on a Grimoire release.

The motivating examples:

- the **token editor** and **UVTT map editor**, which move out of core and ship as
  bundled plugins an admin can switch off
- **importers** for campaign notes (Notion, World Anvil, a richer Obsidian
  import) and characters (DiceCloud)
- a **deck-of-cards** viewer for PDF pages (#205)
- **AI integration** (#455). Grimoire core will never ship AI; a plugin lets an
  admin opt in, and lets each user opt in again for themselves

## The model, borrowed from Jellyfin

Grimoire follows [Jellyfin's plugin model](https://jellyfin.org/docs/general/server/plugins/)
closely, because it is proven, simple, and a natural fit for a self-hosted server:

| Jellyfin | Grimoire |
| --- | --- |
| A .NET DLL loaded into the server process, fully trusted | A Python package loaded into the server process, fully trusted |
| `BasePlugin<TConfiguration>` with a typed config class | `GrimoirePlugin` with a Pydantic `config_model` |
| Interfaces discovered at startup (`IScheduledTask`, `ControllerBase`, metadata providers, …) | One `register(ctx)` hook that adds routes, tasks, event handlers, providers |
| Repositories are `manifest.json` URLs with `targetAbi` and a checksum per version | The existing community catalogue (`index.json`) with `grimoire_min_version` and a SHA-256, plus extra repository URLs |
| Install or update, then restart the server | Same |
| Config pages in the admin dashboard | Same, plus a real web UI extension point (below) |

Two deliberate departures:

1. **A first-class web UI extension point.** Jellyfin has none, so its community
   rewrites `index.html` at runtime to inject scripts. The token and map editors
   are almost entirely UI, so Grimoire gives plugins a supported way to add
   routes, sidebar entries, item actions and importers to the React app.
2. **Per-user opt-in.** Jellyfin plugins are server-wide. A Grimoire plugin can
   declare `user_opt_in`, and stays invisible to each user until they turn it on.

### What "fully trusted" means

A plugin runs inside the Grimoire process with the same access as Grimoire
itself: the database, every user's data, the library, the network, and anything
the server user can read. There is no sandbox. This is the trade Jellyfin makes,
and it is what makes UI-heavy and background plugins practical.

The safeguards are therefore about **consent and recovery**, not containment:

- Third-party plugins are off until an admin enables **Allow plugins**.
- Installing one shows a consent dialog naming the plugin, its author and its
  SHA-256. Approval is bound to that digest, so an update that changes the code
  asks again - the same rule add-on scripts follow today.
- Downloads are verified against the catalogue's SHA-256 and refused on mismatch.
- `GRIMOIRE_SAFE_MODE=1` boots with every non-bundled plugin skipped, so a plugin
  that breaks startup can always be removed.

The declarative add-on kinds (scrapers, themes, note templates, character
sheets, content packs) are unchanged. They run no third-party code in-process
and stay the safe option; a plugin is simply a new `kind` in the same catalogue.

## Anatomy of a plugin

```
deck-of-cards/
├── plugin.json
├── backend/              # optional - a Python package
│   ├── __init__.py       # defines `Plugin`
│   └── _vendor/          # optional - vendored pure-Python dependencies
└── web/                  # optional - a prebuilt ES module
    ├── index.js
    └── locales/
        ├── en.json
        └── de.json
```

### `plugin.json`

```json
{
  "id": "deck-of-cards",
  "name": "Deck of Cards",
  "version": "1.0.0",
  "description": "Flip through or shuffle the pages of a PDF like a deck of cards.",
  "author": "hunter-read",
  "homepage": "https://github.com/…",
  "grimoire_min_version": "1.9.0",
  "backend": "backend",
  "web": "web/index.js",
  "user_opt_in": false
}
```

- `id` is a lowercase slug. It namespaces everything the plugin owns: its URL
  prefix, its API routes, its data directory, its settings, its translations.
- `grimoire_min_version` plays the role of Jellyfin's `targetAbi`: a version
  newer than the running build is not offered, and a manual install is refused.
- `backend` and `web` are both optional. A plugin can be UI-only (deck of cards),
  server-only (a scheduled job), or both (an importer).
- `user_opt_in` hides the plugin from each user until they enable it under
  **Settings → Account**. Its API routes return 404 for users who have not.

### Dependencies

v1 supports **pure-Python dependencies vendored into the plugin** under
`backend/_vendor/` and imported relatively (`from ._vendor import yaml`), so two
plugins vendoring different versions of one library never collide. Packages with
native extensions (numpy, vector databases) are architecture-specific and are
out of scope until a plugin actually needs them - see *Open questions*.

## Backend API

```python
from fastapi import APIRouter
from pydantic import BaseModel

from backend.plugins import GrimoirePlugin, PluginContext


class Config(BaseModel):
    default_hand_size: int = 5


class Plugin(GrimoirePlugin):
    config_model = Config

    def register(self, ctx: PluginContext) -> None:
        router = APIRouter()
        router.add_api_route("/shuffle/{book_id}", self.shuffle, methods=["POST"])
        ctx.add_router(router)                       # → /api/plugins/deck-of-cards/...
        ctx.on("library.scan_complete", self.on_scan)
        ctx.add_scheduled_task("reshuffle", self.nightly, cron="0 4 * * *")
```

`PluginContext` is the plugin's whole view of Grimoire, and the surface that
`grimoire_min_version` promises to keep stable:

| Member | Purpose |
| --- | --- |
| `ctx.add_router(router)` | Mounts under `/api/plugins/<id>/`. Grimoire's auth dependencies apply as for any core route. |
| `ctx.add_scheduled_task(name, fn, cron=…)` | Runs in exactly one worker (see below). Listed in the admin UI. |
| `ctx.on(event, fn)` | Subscribe to core events. v1: `library.scan_complete`; more are added as plugins ask for them. |
| `ctx.add_metadata_provider(...)` | A code-backed sibling of the declarative scrapers, shown in the same **Fetch metadata** dialog. |
| `ctx.config` | The admin-edited config, validated against `config_model`. |
| `ctx.user_config(user_id)` | Per-user settings, for plugins that keep them. |
| `ctx.data_dir` | `DATA_PATH/plugins/<id>/data/`, kept across updates. |
| `ctx.database()` | A SQLAlchemy engine on `data_dir/plugin.db`. A plugin's tables live in its own SQLite file, never in Grimoire's schema, so uninstalling is deleting a directory and core migrations never collide with a plugin's. |
| `ctx.session()` | A session on Grimoire's own database, for reading and writing core records. |
| `ctx.http` | A shared HTTP client with Grimoire's timeouts, size limits and user agent. |
| `ctx.logger` | A logger named `grimoire.plugins.<id>`, surfaced in **Settings → Logs**. |

Python cannot stop a plugin importing Grimoire internals directly, and nothing
does. But only `backend.plugins` is a supported surface - a plugin that reaches
past it may break on any release.

### Loading

- Plugins load **at import time in `backend/main.py`**, after the core routers
  are added to the `api` router and before `app.include_router(api)`, which is
  when FastAPI copies routes onto the app. The SPA catch-all stays last.
- Each package is imported as `grimoire_plugins.<id>` via
  `importlib.util.spec_from_file_location`, never by adding to `sys.path`.
- Every uvicorn worker (`WORKERS`) loads every plugin independently. Scheduled
  tasks and event handlers that must run once use a `.plugins.lock` file lock,
  the same `fcntl.flock` pattern as the startup scan in `lifespan`.
- A plugin that raises while importing or in `register()` is marked
  **malfunctioned** with its traceback shown in the admin UI, and Grimoire boots
  without it. One broken plugin never takes the server down.

### API keys

Plugin routes are tagged `plugin:<id>`. `backend/api_keys.py` refuses routes
whose tag it does not know, so each enabled plugin is registered as a
permission in a new **Plugins** group of the key editor - a key that should reach
a plugin has to be granted it explicitly.

## Web API

A plugin's `web` entry is an ES module that Grimoire loads with a dynamic
`import()`. It calls `registerPlugin` once:

```js
import { registerPlugin, api, components, hooks } from '@grimoire/plugin-sdk'
import DeckView from './DeckView'

registerPlugin({
  routes: [{ path: 'deck/:bookId', element: <DeckView /> }],   // → /p/deck-of-cards/deck/:bookId
  itemActions: [
    {
      target: 'book',
      label: 'deck.open',                 // a key in the plugin's own locale files
      icon: 'cards',
      to: (book) => `deck/${book.id}`,
    },
  ],
})
```

### Contribution points

| Point | Where it appears | First user |
| --- | --- | --- |
| `routes` | Full pages under `/p/<id>/…` | all of them |
| `sidebar` | Entries in the main navigation | token editor |
| `itemActions` | Action menus on a `book`, `map`, `token`, `campaign`, `character`, `wiki-page` or `campaign-member` | map editor (*Edit VTT*), token editor (*Edit token*, member art) |
| `viewActions` | Toolbar buttons on list views (Maps, Tokens, …) | *New token*, *New VTT map* |
| `importers` | Extra sources in the wiki and character **Import** dialogs | DiceCloud, Notion, World Anvil |
| `settingsPanel` | The plugin's page under **Settings → Add-ons**. Omitted, Grimoire renders a form from `config_model`'s JSON Schema. | |
| `userSettingsPanel` | A section under **Settings → Account** | AI (#455) |

More points are added when a real plugin needs one, not speculatively. #205's
deck viewer is the likely trigger for a `readerTools` point inside the book reader.

### The SDK

Plugins must share Grimoire's React, router and i18next instances rather than
bundling their own - two copies of React break hooks. The core build exposes
them on `window.grimoire`, and `@grimoire/plugin-sdk` is a thin package plus a
Vite preset that marks `react`, `react-dom`, `react-router-dom` and `i18next` as
external and maps them onto it. Through the same object plugins get:

- `api` - the authenticated fetch wrapper from `api.js`
- `hooks` - `useAuth`, `useTranslation`, `useFavorites`, `useUISettings`
- `components` - `Spinner`, `IconBtn`, `ToggleSwitch`, modal and toolbar
  primitives, so a plugin looks native and follows the active theme

### Loading and failure

After sign-in the SPA fetches `GET /api/plugins/active` - the plugins enabled
for *this* user, each with a versioned, content-hashed URL for its web entry -
and imports them in parallel. Each contribution renders inside its own error
boundary, so a plugin that throws shows an inline "this plugin failed" notice
instead of blanking the app. A module that fails to load is skipped and logged.

Translations under `web/locales/` are added as the i18next namespace
`plugin-<id>`.

## Distribution

Plugins are a new `kind: "plugin"` in the community catalogue, sharing the
install, update, checksum and semver code in `backend/addons/`. Today
`registry.py` filters to `kind == "scraper"` in places; those paths widen to
cover plugins.

- **Packaging:** a zip of the plugin directory. The catalogue entry carries its
  `sha256`, `version`, `grimoire_min_version`, `author` and `description`, like
  any other kind.
- **Install:** download, verify, extract to `DATA_PATH/plugins/<id>/<version>/`,
  record approval, flag **restart required**. The previous version is kept until
  the new one has loaded once, so a bad update can be rolled back.
- **Manual install:** drop the directory into `DATA_PATH/plugins/<id>/` and
  restart, as with add-ons today. It never reports an update.
- **Repositories:** the single `addons.index_url` setting becomes a list, so an
  admin can add a third-party catalogue alongside the community one, as Jellyfin
  does with repositories.
- **Restart:** Settings shows a banner while any change is waiting for a restart.

**Settings → Add-ons** gains a **Plugins** heading beside *Metadata scrapers*.
Each plugin shows its status (enabled, disabled, malfunctioned, restart
required), version, author byline, and its settings.

## Bundled plugins: the token and map editors

The token editor and the UVTT map editor become the first plugins - **bundled**,
meaning they live in this repo, are built with Grimoire, ship in the image, and
update only with Grimoire releases. They are enabled by default, an admin can
disable them, and they cannot be uninstalled.

Moving them first is the point: two substantial, real features have to be
expressible through the plugin API before any third party is asked to depend on
it. Every gap they hit is a gap a community plugin would have hit.

```
plugins/
├── token-editor/
│   ├── plugin.json
│   ├── backend/       # the token_frames router
│   └── web/           # components/tokens/editor/*, lib/tokenCompositor, lib/frameMask
└── vtt-editor/
    ├── plugin.json
    ├── backend/       # the /maps/{id}/vtt/authoring routes
    └── web/           # components/maps/vtt/*
```

**Token editor.** Its backend is only the read-only `token_frames` router. Its
web code reaches into core for the `campaigns`, `imageSources` and `mediaUrl`
API helpers, `useAuth`, `useFavorites`, `Spinner`, `iconColors` and
`variantLabel` - which defines the first cut of the SDK. Core's four entry points
become contributions:

| Today | As a contribution |
| --- | --- |
| `/tokens/editor` route in `AppShell.jsx` | `routes` |
| *New token* in `TokensView.jsx` | `viewActions` on `tokens` |
| *Edit* in `TokenDetailView.jsx` | `itemActions` on `token` |
| `MemberArtButton.jsx` in campaigns | `itemActions` on `campaign-member` |

**Map editor.** The `/maps/{id}/vtt/authoring` routes move into the plugin. The
authoring document stays in its existing `Map` column so no migration is needed,
and the plugin reaches it through `ctx.session()`. Viewing UVTT maps
(`MapVttPane`, `/vtt/data`, `export.uvtt`) is not editing, and stays in core.
`EditVttButton` on the map detail page and *New VTT map* on the Maps view become
`itemActions` and `viewActions`.

The old URLs (`/tokens/editor`, `/maps/:id/vtt-editor`) redirect to the plugin
routes, so bookmarks keep working. Plugin tests run in the main CI and are held
to the same 80% per-file coverage gate.

## Phases

1. **Core loader.** `plugin.json`, the backend loader and `PluginContext`
   (routes, config, data dir, logging, database), the web loader and SDK with
   `routes`, `sidebar`, `itemActions` and `viewActions`, enable/disable and the
   restart banner, safe mode. Manual install only.
2. **Token editor as a bundled plugin.** Builds out the SDK exports and the
   bundled-plugin build pipeline.
3. **Map editor as a bundled plugin.**
4. **Third-party distribution.** The `plugin` catalogue kind, consent dialog,
   updates and rollback, extra repositories, per-user opt-in, API key
   permissions, scheduled tasks and events, the `importers` point.
5. **First community plugins.** Deck of cards (#205), DiceCloud, Notion and World
   Anvil importers, and #455 for whoever wants to build it.

Third-party installs come last on purpose: the API is not published to anyone
until the two bundled plugins have proven it.

## Open questions

- **Restart.** Can the app restart itself? uvicorn's multi-worker supervisor may
  support restarting workers on `SIGHUP`; if so a **Restart now** button is
  possible. Otherwise the banner tells the admin to restart the container.
- **Native dependencies.** One zip per architecture, or `pip install --target`
  into the plugin directory at install time (needs network and a writable
  `DATA_PATH`)? Deferred until a plugin (likely #455) needs one.
- **Guests.** Should plugins contribute to the guest shell at all? Proposed: no,
  until there is a use case.
- **Plugin URL namespace.** `/p/<id>/…` keeps plugins from colliding with core
  routes. Bundled plugins could be allowed their old paths instead of redirects.
