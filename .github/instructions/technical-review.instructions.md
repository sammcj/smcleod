# Technical Review Guidelines for PR Reviews

`CLAUDE.md` at the repo root is the source of truth. Where these notes and `CLAUDE.md` disagree, follow `CLAUDE.md`.

## Themes

- `themes/deskbar/` is this site's own theme and is edited freely. Shell behaviour, apps and generic layouts belong there; site-only markup goes in the root `layouts/`
- Flag any change to `themes/github.com/` (the upstream `hugo-admonitions` submodule)
- Changes to the look or window behaviour should keep `themes/deskbar/DESIGN.md` in step

## Configuration

- Desktop icons, dock, tray, menu, screen saver and thumbnail emblem rules live under `params.deskbar` in `hugo.yaml`
- The deploy workflow pins the Hugo version and SHA-pins every action. Keep both pinned when updating

## Content

- Old URLs must keep working. A moved or renamed post keeps its `aliases`
- Bespoke thumbnails come from `assets/thumbnails-src/<bundle>.svg` via `make thumbs`; posts without one get an emblem chosen from their tags

## Checks

- Theme JS, CSS, layout or e2e changes should be run through the browser tests locally (CI doesn't run them). Content-only changes don't need them
- Changes to `data/` or site tools should pass `make test`
