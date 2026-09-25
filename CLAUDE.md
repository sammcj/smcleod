# Project Instructions for Coding Agents

- NEVER change `themes/github.com/` (hugo-admonitions, an upstream submodule) or `themes/PaperMod/` (unused leftovers). `themes/deskbar/` is this site's own theme and is edited freely.
- NEVER commit or push a git repo unless the user has explicitly requested you to do so.
- In markdown content always use - for lists, _underscores_ and **bold**
- If you are asked to review the users content, as well as the usual Australian English spelling and grammar, you should check the clarity of prose, ensure there's no fluff, filler, empty verbiage, buzzwords, hype or marketing speak, that the content is clear, concise and to the point as well as being factually accurate and well structured.

## Architecture

- The site's theme is `themes/deskbar/`, a browser desktop (windows, dock, apps) in vanilla JS. It is Hugo module `github.com/sammcj/smcleod/deskbar`, which `go.mod` replaces with that directory. It is kept here rather than published, as it isn't meant for general use.
  - Shell behaviour, apps and generic layouts belong in the theme. Run its checks from `themes/deskbar/` (`npm ci` once): `make test` (unit tests plus the JS size budget) and `make e2e` (Playwright on its example site). Root `make e2e PUBLIC=<dir>` runs the same specs on this site's build. CI runs `make test` only: browser tests are too slow for CI, so run them locally before a PR.
  - Site-only markup goes in this repo's `layouts/`.
- `themes/github.com/` holds `hugo-admonitions`, imported via a `go.mod` replace; the theme's example site uses it too.
- Front matter the theme reads (`thumbnail`, `thumbnailIcon`, `photos`, `layout: photos` and more) is documented in the theme's `README.md`.
- Desktop icons, dock, tray, menu, screen saver and thumbnail emblem rules live under `params.deskbar` in `hugo.yaml`.
- `DEV_PLAN.md` tracks the rewrite. Tick an item only when it is fully done.
- `themes/deskbar/DESIGN.md` holds the design intent, design language and how looks work. Read it before changing the look or window behaviour, and update it when a decision changes them.

## Content

- Old URLs must keep working. Keep a post's `aliases` when moving or renaming it.
- Post thumbnails:
  - Posts without an image get generated emblem art chosen from their tags (`params.deskbar.thumbRules`).
  - Bespoke art: draw `assets/thumbnails-src/<bundle>.svg`, then run `make thumbs`. It writes `thumbnail.png` and `thumbnail-icon.svg` into the bundle. Set `thumbnail`, `images` and `thumbnailIcon` in the front matter.
- Photos app album numbering follows image order in the post body, so "photo 7" is the seventh image, not `7.jpeg`.
- Favourites (`/favourites/`) is a folder that `include`s Favourite Tools (`/links/`, icons from `data/applications.yaml`), Hardware, Podcasts and YouTube Channels (`data/<name>.yaml`). Each keeps its own URL, so add a new favourites collection there rather than on the desktop.
- `data/pinned.json` is refreshed in CI by `scripts/fetch-pinned.sh`. The committed copy is the fallback.
- The Feeds app (`/feeds/`) reads OPML from `assets/feeds.opml`; a NetNewsWire export drops in as is. `params.deskbar.feeds.exclude` drops feeds by URL (Sam's HN replies feed). Hugo fetches the feeds at build time and a failing feed only warns; failed and empty feeds are left out of the list. A `schedule:` trigger in the deploy workflow rebuilds every 6 hours to refresh them.

## Build and checks

- `hugo server` holds the build lock. Side builds need `hugo --noBuildLock -d <dir>`.
- After building, run `make check PUBLIC=<dir>`. It verifies posts, aliases, RSS, internal links and key pages. Known broken external links are listed in `scripts/known-broken-links.txt`.
- CI (`.github/workflows/deploy.yml`) pins Hugo and SHA-pins its actions. Keep both pinned when updating.

## Agentic Coding Tools Comparison Table

`content/agentic-coding-tools.md` renders `data/agentic_tools_comparison.yml` through `layouts/shortcodes/comparison-table.html` and `layouts/partials/comparison-table.html`. Styles are in `assets/css/agentic-tools-table.css`: cell width is `--table-cell-max-width`, and colours are `--highlight-1` to `--highlight-5`, `.category-row` and `.feature-name`.

- Tools come first in the data file. Each tool's `header_highlight: 0-5` colours its header cell.
- `{tool_id}_highlight: 0-5` colours one cell:
  - 0 light blue (meets requirements)
  - 1 light yellow (enterprise required)
  - 2-5 rising concern, light orange to red
- A cell is plain text or a map. The map form adds a link (opens in a new tab), a hover tooltip, or both. URLs inside a tooltip become clickable.

```yaml
tool_name: Simple text value
tool_name:
  text: Display text
  url: https://example.com                    # optional
  tooltip: "More at https://docs.example.com" # optional
```

## Admonitions

```markdown
> [!TIP]
> thing to be in the callout here
```

Other types and options: `themes/github.com/KKKZOZ/hugo-admonitions/README.md`.
