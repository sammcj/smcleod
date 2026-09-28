# Theming

How to add or change a theme, window style, palette, wallpaper, dock or CRT effect. Why the appearance system works this way is in `DESIGN.md` (Appearance system, D38, D39). CSS paths below are under `assets/css/deskbar/`.

## Terms

- **Theme:** a `PRESETS` entry that sets all five parts at once: `deco` (window style), `palette`, `wall` (wallpaper), `dock` and `crt`. It never sets the mode (light, dark or auto), which stays the visitor's. Themes aren't stored. The Control panel shows one as picked when the current parts add up to it.
- **Plain option:** a window style, wallpaper or dock in `lazy/control-panel.css`: BeOS, Flat, Clear, Plain, Grid, Dots, Hills, Deskbar, Panel. All but Clear's wallpaper draw in the palette's colours.
- **Whole look:** a family `<name>` with its own stylesheet, `looks/<name>.css`, that draws a window style, wallpaper and dock in colours of its own (Platinum, Phosphor, Synthwave, Pixel and others). Its wallpaper and dock variants are `<name>-<variant>` values in the same file (the `pixel-pico` wallpaper, the `pixel-cartridge` dock), so a family name can't contain `-`.
- **Colour variant:** a look's own colours, offered under Colours in place of the palettes (Synthwave's Night and Sunrise, Pixel's Pico). They are `palette` values listed in the look's `LOOKS` entry, and none may share a palette's name.

## Where things live

- `assets/js/deskbar/lib/appearance.js`: every option and theme, as data. The Control panel only draws it.
- `palettes/<name>.css`: one palette. Token names are in `tokens.css`.
- `looks/<name>.css`: one whole look, with its variants and Control panel thumbnails. `looks/phosphor.css` is the fullest model of a dark look.
- `lazy/control-panel.css`: the plain options, reader fonts and the Control panel's own UI.
- `effects/crt.css`: CRT effects.
- The defaults (Haiku window style and palette, Rings wallpaper, Glass dock) are in the core stylesheets. `DEFAULT` in `assets/js/deskbar/settings.js` names them.

Nothing needs registering. `layouts/_partials/deskbar/lazy.html` builds each palette, look and effect file as its own stylesheet (`palette-<name>`, `look-<name>`), and `head.html` beside it links the ones the stored choices need before first paint.

Append new entries to the arrays in `appearance.js` rather than inserting them. The tests pair each theme and palette with a viewport, mode and axe state by its position, so inserting reshuffles the pairings of the existing ones. A new plain window style reshuffles the palette pairings wherever it goes, so run `palettes.spec.mjs` with `AXE_ALL=1` after adding one. That run is also its only contrast check.

## Add a theme

1. Append to `PRESETS`, naming all five parts. `...whole('<name>')` gives `deco`, `wall` and `dock` of `<name>`, palette `haiku` and crt `off`; override after the spread (Phosphor adds `crt: 'tube'`). A look with colour variants must set the palette to one of them, as Pixel's theme does with `palette: 'pixel'`.
2. A whole look's own theme must have the look's name as its id. `e2e/appearance.spec.mjs` picks theme `<name>` for each `look-<name>` sheet.
3. If the theme's window style is a whole look, add an entry to `SIGNS` in `e2e/looks.spec.mjs`, keyed by theme id. Each entry is two to four `[selector, camelCase computed property, string or RegExp]` checks that prove the look applied, read on a desktop with the Control panel open over a post and Posts. The keys must match the whole-look themes exactly, so a missing or extra key fails.

A site's starting look (`params.deskbar.appearance`) must match a theme. The site repo's `tests/appearance.test.mjs` checks it (`make test` at the site root).

## Add a palette

1. Create `palettes/<name>.css` with one token block, `:where(:root)[data-palette=<name>] { ... }`, using `light-dark()` for both modes. Include `--wall-1`, `--wall-2`, `--wall-3`, `--wall-glow` and `--wall-ring`, or the plain wallpapers keep Haiku's colours.
2. Rules beyond tokens:
   - On an element a plain window style also styles (panel, tasks, menu button): write `:where(:root[data-palette=<name>]) <selector>`. At full specificity it ties with the window style's rule, and the winner then depends on load order, which differs between a visit and a reload.
   - On an element only the base sheet styles: `:root[data-palette=<name>] <selector>` is fine, and needed when that base sheet is lazy and loads after the palette (e.g. `.ticker-h` in `lazy/ticker.css`).
3. If its panel is light in light mode, add it to the light-panel `:is()` lists at the top of `lazy/control-panel.css` (Snow, Mint, Peach).
4. Append `['<name>', 'Label', '#tab #frame #desk']` to `PALETTES`. The swatch is the light `--tab`, `--frame` and `--wall-2` as 6-digit hex. `e2e/palettes.spec.mjs` checks the first against the rendered tab, and the dark tab must differ from Haiku's.
5. Add it to the palette lists in `README.md` and in `DESIGN.md` under Appearance system.

## Add a plain window style, wallpaper or dock

1. Style it in `lazy/control-panel.css`, scoped to `:root[data-deco=<v>]`, `.wm[data-wall=<v>] body` or `.wm[data-dock=<v>] #dock`.
2. Draw its thumbnail as `.cp-deco.<v>`, `.cp-wp.<v>` or `.cp-dk.<v>`.
3. Append it to `DECOS`, `WALLS` or `DOCKS`, and to the lists in `README.md` and `DESIGN.md`.

Clear's block in `control-panel.css` is a compact example of a window style. Put a new style's rules after the light-panel palette rules at the top of the file: they tie on specificity, and the window style should win. A new dock must also differ in computed style from every other dock (`e2e/appearance.spec.mjs`).

## Add a whole look

1. Create `looks/<name>.css`. Scope every rule to its part, so nothing applies when that part isn't picked:
   - window style: `:root[data-deco=<name>] ...`
   - wallpaper: `.wm[data-wall=<name>] body`, `.wm[data-wall=<name>] #desk::after`, and `.wm[data-wall=<name>] { --wall-3: ... }` for the page's root colour
   - dock: `.wm[data-dock=<name>] #dock`, and `:root.wm[data-dock=<name>] { --dock-h: ... }` if its height differs
   - thumbnails: `.cp-deco.<name>`, `.cp-wp.<name>`, `.cp-dk.<name>`, each unlike every other thumbnail
   - Prefix selectors (`[data-wall|=<name>]`) and combined blocks (`:root:is([data-deco=<name>], [data-wall=<name>])`) are fine, but each offered value must also appear literally as `[data-deco=<v>]`, `[data-wall=<v>]`, `[data-dock=<v>]` or, for colour variants other than the first, `[data-palette=<v>]` somewhere in the file. The unit test looks for that text.
   - colour variants other than the first: `:root[data-deco=<name>][data-palette=<v>]`, so they apply only under the look's window style
2. Keep `--wall-*` out of the window style's token block, so the style doesn't recolour a plain wallpaper. The look's wallpaper and dock use literal colours, or custom properties set on themselves (Phosphor's `--fk` on `#dock`), because they must also work under another window style where the look's tokens don't exist. Window tokens stay at full weight on `:root[data-deco=<name>]`, so a palette picked under the look can't reach them. The one exception is a look with colour variants (Synthwave, Pixel): it sets the plain wallpapers' `--wall-*` on `:where(:root)[data-deco=<name>]`, a palette's weight, so a plain wallpaper takes its colours while its own wallpaper keeps its own.
3. A dark-only look sets `color-scheme: dark` in its window style block and hides the mode button with `:root[data-deco=<name>] #themeBtn { display: none; }`. `dark: true` in `LOOKS` only turns off the Mode control.
4. Style the whole shell, not just windows, using `phosphor.css` as the checklist:
   - panel, windows, tabs, controls, the resize handle, snap preview
   - toolbars, inputs, menu, context menu, Spotlight, the switcher, Recent
   - desktop icons, selection, `mark`
   - Tracker, the reader and its admonitions, the Terminal app (`.app-terminal`)
   - phone mode (`@media (max-width: 767px), (max-height: 500px) and (pointer: coarse)`). If the look clips `.views` for rounded corners, undo that there.
5. In `appearance.js`, append:
   - `['<name>', 'Label']` to `DECOS`, `WALLS` and `DOCKS`, plus any `<name>-<variant>` values
   - a `LOOKS` entry: `dark: true` if dark only; `colours: [[value, label, swatch], ...]` if it offers colour variants, its own first
   - its theme to `PRESETS` (see Add a theme), and its `SIGNS` entry
   - in `e2e/looks.spec.mjs`, the look's name to `SPANS` if its title bar spans the whole window width
6. Behaviour beyond styling (sound, animation, layout) gets a test in `e2e/look-details.spec.mjs`.
7. Record the decision in `DESIGN.md`'s register, and add the look to the lists in `DESIGN.md` (Appearance system) and `README.md` (Customising).

## Add a CRT effect

Add it to `effects/crt.css` and `CRTS`, with a `.cp-crt.<v>` thumbnail. Effects draw on `html::before` and `html::after`, so looks must not use those.

## What the tests check

Most are in `e2e/looks.spec.mjs` and run for every theme:

- Picking a window style changes only the window style. It also changes the colours if the new style doesn't offer the current ones, and the mode if it is dark only. Picking a dock or wallpaper changes only that. Only a theme changes everything.
- A look's stylesheet loaded on its own changes nothing. Its wallpaper changes only the desktop, and its dock only the dock.
- A wallpaper's pseudo-element layers are `position: fixed`, `z-index: -1` and `pointer-events: none`, and it runs no infinite animation (Pixel's are exempt).
- Contrast of 4.5 or better on titles, post text, toolbar, Posts and panel, in light and dark, plus axe per theme. Post text (`.rd p`) has no `text-shadow`.
- The first font in the panel, tab title and body is actually loaded. Use the theme's self-hosted fonts (`var(--mono)` and others) or bundle a new one under `static/fonts/`.
- On a phone: the title bar is at least 36px tall (a look with a taller one sets its minimum in `BAR`), the close button at least 32×30, the toolbar sits under the title bar, the window is full width, and dock launchers are at least 44px tall.
- Every window style, wallpaper, dock and effect draws a thumbnail unlike the others.

Elsewhere:

- `e2e/appearance.spec.mjs`: each `look-<name>` sheet loads with its theme, every dock looks the same chosen in a visit as after a reload, and so do a few fixed palette and window style pairs. New looks aren't in those pairs, so a look that relies on a specificity tie can pass here and still differ after a reload.
- `e2e/palettes.spec.mjs`: each palette blocks rendering, paints its own tab colour, and passes axe in light and dark.
- `tests/control-panel.test.mjs`: every offered value has styles naming it; docks, wallpapers and effects have thumbnails; `looks/*.css` files and `LOOKS` entries match one to one; theme ids are unique and name only offered values.
- `scripts/size-budget.mjs` (in `make test`): each look and palette sheet is at most 12KB gzipped.

## Test

From `themes/deskbar/` (`npm install` once):

```sh
make test   # unit tests and size budgets
make e2e SPECS="e2e/looks.spec.mjs e2e/appearance.spec.mjs e2e/palettes.spec.mjs e2e/look-details.spec.mjs"
make e2e    # everything, once the targeted specs pass; AXE_ALL=1 for the full axe matrix
```
