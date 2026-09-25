# deskbar design

Why the theme looks and behaves the way it does, for anyone (human or agent) changing it. Configuration is in `README.md`. Decisions are numbered D1 to D38 in the site's `DEV_PLAN.md`, each with its reason, and the numbers below point there.

## Intent

smcleod.net is a blog presented as a small desktop OS in the browser. Posts open in a reader window, apps and tools run in windows, and a visitor can arrange things like a desktop. Reading a post is still the main job. The desktop exists to make browsing the archive and tools enjoyable, not to get in the way.

The site is also a showcase of an OS-like experience in plain HTML, CSS and JavaScript, small enough to read, with no framework (D18). Code size is a feature. Clever code that saves little is not.

## Non-negotiables

- **Static and crawlable.** Every page is a real prerendered HTML document on GitHub Pages (D1). Without JavaScript it reads as a plain page, and search engines, feed readers and old links see the same content. The shell only enhances it.
- **Every state has a URL.** The address bar shows the page on screen, headings have anchors, and "Copy layout link" captures the whole arrangement (D12). Old permalinks and aliases must keep resolving, which `make check` in the site verifies.
- **Mouse and touch first.** Nothing requires a keyboard shortcut (D3). Shortcuts (Cmd/Ctrl+K, Escape, q or w to close the focused window, f to maximise it, a to tile every window and again to put them back, ` to drop the terminal down, ? to list them all) are extras, and never fire while a field, dialog or menu has the keys, bar ` in the terminal, which puts it away.
- **Phones are first class.** Under about 768px (or short and touch, as when held sideways) each window is full screen, one at a time, with a switcher (D17). The home screen is a phone's: a Latest posts widget over the desktop icons in a grid, so the OS shows at once and posts stay one tap away. Touch targets are 44px. The page scrolls rather than a pane, as mobile browsers only draw content under their toolbars for a scrolling document; keep sticky elements to the panel, a window's tab and toolbar, and the dock, as iOS Safari fills a flat bar under its toolbar once anything else sticks mid-page.
- **Small.** The core shell stays at or under 45KB gzipped and every on-demand bundle at or under 12KB, enforced by `make test`. Features outside the core load on first use (`loader.js`).
- **Accessible.** Text at 4.5:1 or better in light and dark, in every palette and look. axe runs in the e2e suite across palettes, looks and viewports. `prefers-reduced-motion` turns animation off.
- **No MS Windows.** No Start button, no bottom taskbar with a start menu, no Windows look or metaphors.

## Design language

The default look, "Deskbar Classic", blends Haiku (and BeOS before it) with XFCE (D2). It won over a flat modern take and a tactile hacker desk because it had the most character while staying usable. The prototypes are in the site's `spikes/`.

- **Windows.** Grey bevelled frames (`--frame`, `--frame-hi`, `--frame-lo`, `--frame-dk`) under a yellow Haiku tab that sizes to its title and can slide along the top edge. Controls are explicit minimise, maximise and close icons with tooltips rather than Haiku's unlabelled squares, because most visitors never used BeOS (D4). Unfocused windows get a muted tab and dimmed title so the focused one is obvious (D20). Stacked windows show one tab per window plus a dotted grey handle for the stack (D34).
- **Top panel.** After XFCE, it holds the Menu (a leaf), window tasks, search, a tray of links and the clock.
- **Dock.** Centred launchers at the bottom, Home first and the Windows switcher last, each set apart by a divider (D29, D30). Home toggles like XFCE's Show desktop (D24). The switcher rolls out as a column of the windows' own tabs, never a foreign card.
- **Desktop.** A column of icons on the left with dark label pills that read on any wallpaper. Wallpapers are quiet (rings, plain, grid, dots, hills) so windows stay the focus.
- **Icons.** Drawn in Haiku's HVIF style, with objects seen slightly obliquely, lit from the top-left, tone-on-tone outlines and restrained gradients. Folder variants are the base folder with a badge (`videos`, `podcasts`, `hardware`, `software`). Sprite symbols live in `_partials/deskbar/icons.html`.
- **Post thumbnails.** One Haiku-style object per post on a quiet muted ground, no props, glow or clip art (D21). Posts without a bespoke cover get a generated emblem chosen by tag.
- **Type.** Noto Sans for the interface, Source Serif 4 for reading (18px default, adjustable), JetBrains Mono for code. Atkinson Hyperlegible is offered as a reader font.
- **Motion.** Short and functional, such as View Transitions on window opens and swaps and a staggered slide on the switcher. No bouncing for its own sake, except in Liquid Ass, where it is the joke.
- **Restraint.** No first-run tips or hint bubbles (D11). No pop-up notifications (the related-posts ticker sits along the bottom of the reader, D25, D27). If something needs a caption to be understood, redesign it rather than caption it.

## Window model

- **Reading layout.** Opening a post from Tracker snaps Tracker to the left 25% and the reader to the right 75% (D7). There is one shared reader with its own Back and Forward, so posts don't pile up (D8). Escape closes the post and puts Tracker back exactly where it was (D36).
- **Posts window.** Tracker is both the archive browser and the first-load "recent posts" view. It opens compact beside the icons, with cards for the newest posts, rows by year below (D10, D36).
- **Your own windows.** A post dragged out of Tracker opens in a window of its own (D32). Windows snap to halves and quarters with a preview (D5), stack by dropping one tab on another, and tear off again.
- **No virtual workspaces** (D6). They add complexity with no benefit on a website.
- **Apps.** Tools, Photos, Terminal, Feeds, Sketch, Chiptunes and the Control panel are windows registered with `defineApp` or `lazyApp`. Tools run as apps because they are among the most-used content (D14).
- **Folders.** Pages with `layout: folder`. They list child pages, `include`d pages and data-file items, so collections such as Favourites and Projects need content and data only, no code. A folder of folders is browsed in one window, as in a file manager: a sub-folder opens in place with Back and Up in the toolbar, and each keeps its own URL. Opened from anywhere else, a folder gets its own window.

## Appearance system

All colour and chrome comes from custom properties in `assets/css/deskbar/tokens.css`. Visitor choices live in the Control panel (D31) and are stored as `deskbar:<key>` in localStorage. `head.html` applies them as `data-*` attributes on `<html>` before first paint, and links the Control panel's stylesheet (and a look's) only when a non-default choice needs it, so the default costs nothing.

- **Palettes** (`[data-palette]`, one stylesheet each in `palettes/`) replace tokens only: Haiku, BeOS, Xfce and Sage, plus the lighter Snow, Mint and Peach with near-white frames and panel, Synthwave (pink tabs, lavender or indigo frames, cyan links in dark), and four borrowed from editor themes and places: Rosé (Rosé Pine), Ember (Gruvbox), Solar (Solarized) and Lagoon (mid-century poolside). Their token blocks sit at `:where(:root)` specificity, so a look or glass style outranks them whatever order the sheets load in.
- **Window styles** (`[data-deco]`): Haiku, BeOS, Flat, and the glass pair Liquid Ass (a spoof of Apple's Liquid Glass: too much blur, padding and rounding) and Clear (the same glass without the joke).
- **Whole looks** (D38): Platinum (Mac OS 9), Clearlooks (GNOME 2), Phosphor (an amber CRT), Broadsheet (neo-brutalist newsprint), Synthwave (80s outrun: neon-edged indigo windows, a striped sun over a perspective grid, dark only) and Pixel (modern pixel art: ink-ringed windows with a dithered sun title bar, Pixelify Sans chrome, a hotbar dock, a dithered sky over tiling hills, day in light and a starry dusk in dark). Each is one stylesheet in `assets/css/deskbar/looks/` that draws the window style, its wallpaper, a dock skin and its Control panel thumbnails, and sets its own colours. `LOOKS` in `lazy/control-panel.js` says which wallpaper and dock each brings and which Appearance groups it owns, which are then disabled. Picking a look saves the visitor's wallpaper and dock, and leaving it restores them. A look with a different image per theme sets a custom property under `[data-theme=dark]` and under `[data-theme=auto]` with `prefers-color-scheme`, since `light-dark()` takes colours only.
  - Scope every rule to `[data-deco=<name>]`, `.wm[data-wall=<name>] body` or `.cp-deco.<name>` / `.cp-wp.<name>`. Nothing may apply when the look is off. The Control panel preloads every look's stylesheet for its thumbnails.
  - A look must cover the whole shell, not just windows: panel, menu, context menu, dock, switcher, Spotlight, toolbars, inputs, Tracker, the reader and phone mode. The Liquid Ass and Clear blocks in `lazy/control-panel.css` are the checklist.
  - Each look has its own `e2e/look-<name>.spec.mjs` with an axe pass. The concept sheet the four were picked from is published at `/design/theme-concepts.html` (source: the site's `spikes/theme-concepts.html`).

## How it is built

- **Enhance real pages.** The shell boots over the prerendered page, wraps its content in a window and intercepts internal links. A link fetches the target page, extracts its content and updates history with `pushState`. Aliases are static redirect stubs, since Pages has no server redirects.
- **Platform over libraries** (D18). Container queries so window contents follow the window's width, the Popover API and `<dialog>` for menus and modals, View Transitions, pointer events for drag and snap. Third-party code is limited to content rendering (Mermaid, MathJax), loaded only on pages that use it.
- **Core versus lazy.** The window manager, router, panel and dock are core. Everything else loads on first use through `loader.js`, and a lazy module reaches the shell through `window.deskbar`, never by importing shell modules (which would duplicate their state).
- **Build-time data.** Hugo emits the JSON indexes the shell reads (posts, search, albums), fetches RSS for Feeds and card previews, and resizes preview images into the site. Nothing is hotlinked, and a failed fetch only warns.
- **Configuration over code.** Desktop icons, dock, tray, menu, screen saver and thumbnail rules are `params.deskbar` in the site's `hugo.yaml`.

## Rejected

- Virtual workspaces (D6), per-post windows piling up (D8), first-run tips (D11), pop-up notification cards (D25).
- Any UI framework, Astro or a custom markdown build (D18, D23).
- Publishing the theme for general use (D35). It is made for this site.
- Adding palettes, window styles and wallpapers for a new aesthetic separately (D38). A look only works as a set.
