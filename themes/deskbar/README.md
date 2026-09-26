# deskbar

The Hugo theme for smcleod.net. It lives in this repo rather than as a published theme. It turns a blog into a small desktop in the browser, after Haiku (BeOS) and XFCE. Posts open in a reader window, Tracker browses posts by year, tag and series, and windows snap, stack and tile. Every page is still a plain HTML document, so it reads fine without JavaScript, in feed readers and on search engines.

- Hugo 0.146.0 or newer (standard edition is enough)
- No runtime dependencies. Shell JS and CSS stay under 45KB gzipped.
- Phones (under 768px wide, or under 500px tall with touch, as when turned sideways) get one full-screen window at a time with a switcher. The page itself scrolls there, so it runs under a browser's floating toolbar, and the home screen shows it is a desktop: a Latest posts widget (the newest three, and All posts, which opens Tracker) over the desktop icons in a grid, with the dock below
- The Windows switcher copies a link to the current layout (`?layout=`), which reopens the same windows and snaps
- A post dragged out of Tracker onto the desk opens in a window of its own, where it lands, with its own Back and Forward. Cmd/Ctrl-click and Shift-click (or Shift+Up/Down) select several posts in Tracker; drag them out, or open them with Enter, the toolbar button or the context menu. Desktop only; a middle click still opens a browser tab
- Dropping a window's tab (or a stack's handle) on another window's tab stacks them in one frame. Each tab keeps its own close button. The grey dotted handle after the tabs moves the whole stack and holds its minimise and maximise. Drag a tab away to tear it off. Desktop only
- The desktop opens with Tracker as a compact Posts window beside the icons, newest posts as cards, with its toolbar to change the view. Home shows it there again. It minimises, closes and stacks like any other window, and a link to the posts section (the Posts icon) raises or reopens it. On phones the newest posts are the home screen instead
- Escape in a post opened from Tracker closes it and puts Tracker back where and how big it was. Fields, menus and dialogs keep their own Escape, and a post window of its own ignores it
- q or w closes the focused window's front tab, as its close button does, f maximises or restores it, a tiles every open window over the desk, or puts them back, ` or ~ drops the terminal down from the top across 60% of the screen (` in it puts it away, session kept), and ? lists every shortcut. Fields, dialogs and open menus keep the keys, and modified presses are left alone
- A dock item whose window is in front minimises it, and brings it back when minimised, as a task button does
- Folders opened one after another tile side by side at up to their own size (an app's `tile: true`), until the visitor moves, resizes or snaps one
- A folder opened from inside a folder window shows in that window, which keeps its size. Its toolbar has Back and Up (Alt+Up or Backspace), and browser Back returns to the folder it showed before

## Install

A Hugo module, replaced with this directory in the site's `go.mod` (`replace github.com/sammcj/smcleod/deskbar => ./themes/deskbar`):

```yaml
# hugo.yaml
module:
  imports:
    - path: github.com/sammcj/smcleod/deskbar
outputs:
  # "deskbar" is the post index the shell reads; themes can't set a site's outputs, so add it here.
  # "deskbarsearch" publishes /search.json for Spotlight search; leave it out and the panel has no search button.
  home: [html, rss, deskbar, deskbarsearch]
# Optional: each post's markdown at index.md, for the reader's "Copy as markdown" button. Shortcodes are rendered;
# give one a <name>.markdown.md template (e.g. a link in place of an embed) when its HTML reads badly as markdown.
cascade:
  - target: { path: /posts/**, kind: page }
    outputs: [html, markdown]
```

## Configuration

```yaml
params:
  description: Site description used for meta tags
  deskbar:
    readerSections: [posts]   # pages in these sections open in the reader and feed Tracker
    favicon: /favicon-32x32.png
    timeZone: Australia/Melbourne   # panel clock; empty uses the visitor's zone
    relatedCount: 4           # related posts (shared tags) at the end of each post
    searchBodyChars: 3000     # how much of each page's text Spotlight searches
    screensaver: { minutes: 5 }   # idle minutes before the screen saver starts; 0 turns it off
    stylesheets:              # extra CSS, e.g. web fonts, loaded after the theme
      - https://fonts.googleapis.com/css2?family=Noto+Sans&display=swap
    icons:                    # desktop icons
      - { name: Posts, url: /posts/, icon: folder }
      - { name: About, url: /about/, icon: person }
    dock:
      - { name: Posts, url: /posts/, icon: folder }
      - { name: Source, url: "https://github.com/you/site", icon: git }
    menu:                     # menu groups after the built-in Writing one; a group's page is its app
      - name: Tools
        page: /tools          # icon: defaults to the page's own icon, then a folder
        items:
          - { page: /tools/demo }   # entries take the page's title and icon unless name or icon is set
      - { name: System, icon: control-panel, items: [{ page: /control-panel }] }
    thumbRules:               # emblem for generated thumbnails; first rule matching a tag or category wins
      - { emblem: car, keywords: [cars, bmw] }
      - { emblem: code, keywords: [coding, golang, rust] }
```

Posts without an image get a generated card: one Haiku-style object (the emblem) on a quiet ground. Posts without `thumbnailIcon` get the bare emblem as their list-row icon. Emblems: `neural windows terminal window code doc branch globe disk container car camera house gpu chip padlock screen laptop server record board chart plug palette chat briefcase` (`doc` when nothing matches). They live in `data/deskbar/emblems.yaml`, which also documents the drawing conventions. Setting `thumbRules` replaces the theme's default rules, so list every rule you want.

Icons: `folder apps favourites projects doc write term person chart image globe git home leaf photos tools theme appearance control-panel sketch music vram compare tiers quantise energy mail feeds videos podcasts hardware software blogs ai`. External URLs open in a new tab.

Front matter the theme reads:

```yaml
cover: cover.jpg          # or { image: cover.jpg, hidden: true }; bundle resource, global asset or URL
thumbnail: thumb.png      # card image, centre-cropped to 4:3; falls back to the cover (smart-cropped), then to generated art
thumbnailIcon: icon.svg   # list-row icon (a bundle resource, shown at 24px), in place of the generated emblem
icon: person              # window icon for non-post pages
deskbarHidden: true       # leave this page out of Tracker's Pages list and Spotlight search
searchHidden: true        # leave this page out of Spotlight search only
searchKind: tool          # Spotlight group for this page (post, page, tool, photo); e.g. a folder of tools
window: photos            # open in a registered app instead of the default window
windowWidth: 880          # default window width for this page in any app (px; plain pages default to 680)
windowHeight: 546         # default window height, likewise; a page with either size opens centred, clamped to the desk
windowBesidePosts: true   # with a size: no taller than the Posts window, and just right of its home spot when it fits there
math: true                # load MathJax (\( \), \[ \], $$ $$); prose with those delimiters also triggers it
photos: true              # give this post an album in Photos and a "View photos" chip (so does the gallery shortcode)
frame: /tiers.html        # with layout: tool, window: tool - embed a standalone HTML file as a tool window
```

Mermaid (```` ```mermaid ```` blocks) and MathJax load only on pages that use them, pinned to exact versions (`assets/js/deskbar/lazy/mermaid.js`, `assets/js/deskbar/content/cdn.js`). Mermaid is self-hosted from `static/vendor/` (`make vendor-mermaid V=<version>`, then bump `MERMAID` in `lazy/mermaid.js`), and its ESM build fetches only the chunks each diagram type needs. MathJax comes from jsDelivr with Subresource Integrity. Set `window.deskbarCDN = { mathjax: { src, integrity }, mermaid: { src } }` to move either. Code highlighting needs `markup.highlight.noClasses: false`.

Folders are pages with `layout: folder` and `window: folder`. They show the section's pages and any page paths in `include` as icons, then the page's own content. Up goes to the parent section when it is a folder, else to the first folder that includes the page. `items: <data key>` adds entries from a data file, grouped by category:

```yaml
# data/apps.yaml
- { name: Hugo, url: "https://gohugo.io", icon: /img/apps/hugo.png, description: Site generator, category: Tools }
- { name: Notes, url: /notes/, icon: doc }   # icon: image path, sprite name, or none for a monogram tile
```

Links to other sites open in a new tab. `view: list` shows rows with the description and a `meta` list (e.g. `[Go, 120 stars]`), and `itemPages: { <item name>: <page path> }` adds a "Read more" link to a page on the site.

`view: cards` shows each item as a preview image over its name, the title of its feed's newest entry and its description. Previews are made at build time, cropped to `thumbSize` (default `320x240`) as WebP, so the page never hotlinks a large original:

```yaml
# content/youtube.md front matter: view: cards, thumbSize: 320x180, items: youtube
# data/youtube.yaml
- name: Fireship
  url: https://www.youtube.com/@Fireship
  feed: https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA
  thumb: https://i.ytimg.com/vi/ylO0DQeVEBQ/mqdefault.jpg
```

- The image is the first that works of: the feed's artwork (a podcast's `itunes:image`), its newest entry's `media:thumbnail` (a YouTube channel or playlist feed), then `thumb`
- `feed` and `thumb` are URLs, or paths under `assets/` for images kept in the site and for offline fixtures
- A feed or image that fails only warns, and the card falls back to the next image or a monogram. YouTube's feeds often answer 404, so give channels a `thumb`
- A YouTube feed needs the channel id (`channel_id=UC...`), which `@handle` and `/c/` URLs don't show; the channel page's canonical link has it
- Feeds are read on every build, so previews only change when the site is rebuilt, and `caches.getresource.maxAge` applies as for Feeds below

Tools always open in a window. A same-origin link to a standalone HTML file opens the tool page that frames it, or else a window framing the file, titled from its `<title>`.

Sketch is a drawing app: a page with `window: sketch`. It keeps the last drawing in localStorage and saves PNGs.

Chiptunes is a media player: a page with `layout: chiptunes` and `window: chiptunes`. It plays `data/chiptunes.yaml`, whose tracks are either song data synthesised live with Web Audio (format at the top of `lazy/chiptunes.js`, songs in `assets/chiptunes/`) or audio URLs hosted outside git, such as GitHub Release assets. The theme ships four AI-composed songs. Opening it plays the first track once the visitor has pressed something on the page (browsers allow sound only then), so a page loaded straight into the player waits for Play. Closing its window stops the sound.

Feeds is a feed reader: a page with `layout: feeds` and `window: feeds`. Hugo fetches the feeds listed in the site's `assets/feeds.opml` at build time, since browsers can't read other sites' feeds, and the page lists the newest items, so it reads without JavaScript too. The list is OPML as feed readers export it (NetNewsWire: File > Export Subscriptions, saved as `assets/feeds.opml`); folders are flattened, `params.deskbar.feeds.exclude` drops feeds by `xmlUrl`, and an `xmlUrl` without a scheme reads a file under `assets/` (the example site's fixtures do this). RSS 2.0, RSS 1.0 and Atom work. A feed that fails to fetch or parse is skipped with a warning, never failing the build, and it is left out of the list, as is a feed with no items. Summaries are plain text. `params.deskbar.feeds: { perFeed: 10, summaryChars: 280 }` are the defaults; every feed keeps its newest `perFeed` items. Items only change when the site is rebuilt, so schedule a rebuild (a cron-triggered deploy) to keep them fresh, and set `caches.getresource.maxAge` (e.g. `6h`), or local builds keep the first copy of each feed for ever. The app has feeds with unread counts, the items and a preview with an Open article link; read state stays in the browser. Refresh refetches the page for whatever the latest build fetched.

Photos lists albums from `data/albums.yaml` plus posts that opt in with `photos: true` or `{{</* gallery */>}}`. An album's `exclude` lists photo numbers (1-based, in source order) to leave out, and `pin: true` puts it first, where Photos opens. The Photos page is whichever page has `layout: photos`; without one there is no in-post lightbox or "View photos" chip.

Sections list in Tracker; taxonomy terms (`tags`, `series`) become Tracker places, and their URLs open Tracker at that place.

Spotlight search opens from the panel's magnifier, Cmd/Ctrl+K or `/` (the shortcuts never fire while typing in a field). It searches posts, pages, tools, photo albums, tags and series, including the first `searchBodyChars` of each page's text. Its code, stylesheet and `/search.json` load on first open. The index URL carries `?v=` plus the site's last modified time, so enable `enableGitInfo` (or set `lastmod`) if your host caches JSON for long.

The Terminal is a page with `window: terminal` (the example site has `content/terminal.md`). `ls`, `cd` and `pwd` walk posts by year, tags, categories and pages; `cat` and `open` show them in their windows; `grep` searches `/search.json`. `whoami` quotes the first paragraph of `/about/`, and `fortune` picks a blockquote from a `/quotes/` page when there is one. `help` lists the rest. Output is text nodes only, and the history is kept in localStorage.

The screen saver starts after `screensaver.minutes` without input, but never while a post or page shows in a window on screen (a minimised one doesn't count), or while focus is in a framed tool or a menu or dialog is open. There are two: Sheep (the default), the 1990s eSheep desktop pet with gSheep Purple's sprites, and Leaves, falling on a dark screen after Haiku's saver. Sheep wander the dimmed desktop along the tops of the windows on screen, the dock and the bottom edge, turn at walls, fall off edges, hop onto window tabs, graze, sleep and multiply. Sheep is its own bundle, and it loads its sprite sheet (`static/vendor/esheep/`) only when it starts. In the Control panel's System pane visitors pick one (`deskbar:saverKind`, stored only for Leaves), test it, and turn it off or pick 1, 5, 10 or 30 minutes (`deskbar:saver`, which overrides the site's). Any key, press, wheel or real pointer movement ends it, and the input that wakes it goes nowhere else. It also starts from the Terminal (`screensaver`, or `screensaver sheep` for one by name) and from any link to `/screensaver/`, which a site can list in its menu with a page for visitors without JavaScript. With reduced motion it shows a still frame.

## Customising

- `layouts/_partials/hooks/head-end.html` and `hooks/body-end.html` are empty override points (analytics, extra scripts)
- Theme colours are CSS custom properties in `assets/css/deskbar/tokens.css`; override them from a stylesheet in `params.deskbar.stylesheets`
- Visitors change the desktop in the Control panel, a page with `window: control-panel` (the example site has `content/control-panel.md`, aliased from `/appearance/`). Each pane has an address (`?pane=posts`, `?pane=system`, none for the first), which layout links keep:
  - **Appearance:** a row of themes, then each part on its own: window style, colours, mode, dock, wallpaper and CRT effect. A theme sets all of them but the mode, which stays the visitor's; the theme shown is the one the current choices add up to. Every choice and theme is data in `assets/js/deskbar/lib/appearance.js` (themes are `PRESETS` there, as `theme` is already the mode setting):
    - Palettes: Haiku, the cleaner Crisp, BeOS, Xfce, Sage, the light Snow, Mint and Peach, the pastel Lilac, Blossom and Lemon, the neon Synthwave, Rosé, Ember, Solar, Lagoon, Cobalt and Racing Green. Mode is light (the default), dark or auto (follows the OS).
    - Window styles: Haiku, BeOS, Flat, Clear, Liquid Ass, Platinum, Clearlooks, Phosphor, Broadsheet, Synthwave and its variants Vector, Memphis and Night Drive, and Pixel. Liquid Ass spoofs Apple's Liquid Glass (over-blurred glass, mismatched corner radii, traffic lights on the left, wobbly buttons); Clear is the same glass without the joke.
    - Whole looks (`LOOKS`): Platinum (Mac OS 9), Clearlooks (GNOME 2), Phosphor (an amber CRT), Broadsheet (neo-brutalist newsprint), Synthwave and its variants (80s outrun) and Pixel (retro pixel art in Pixelify Sans from `static/fonts/pixelify-sans/`) draw in colours of their own, so Colours is off while one is on, and Mode too for the dark-only ones. Pixel offers its own colour variants there instead.
    - Docks: Glass, Deskbar and Panel, plus each look's own dock, which goes with any window style.
    - CRT effects: scanlines, the Phosphor tube, an aperture grille, and amber or green monochrome, over any look.
    - A new look is `assets/css/deskbar/looks/<name>.css` plus its lines in `lib/appearance.js`. Scope every rule to `[data-deco=<name>]`, `[data-wall=<name>]`, `[data-dock=<name>]` or its `.cp-deco`, `.cp-wp` and `.cp-dk` thumbnails; its variants are `<name>-<variant>` values in the same file. It builds as its own stylesheet, which head.html links before first paint whenever the stored window style, wallpaper or dock is of its family
  - **Posts:** the reader's width, text size and font: the theme's serif, sans or mono, or Atkinson Hyperlegible, self-hosted in `static/fonts/` and fetched only once chosen. The reader's A-, A+ and width buttons change the same settings
  - **System:** which screen saver (Leaves or Sheep), a Test screen saver button, and its delay
- Choices live in localStorage and come back before first paint. Looks other than the defaults are in `assets/css/deskbar/lazy/control-panel.css`, which `head.html` links only when one is chosen (after the core stylesheet, where the app's own load puts it too), as `[data-deco=<name>]`, `.wm[data-wall=<name>] body`, `.wm[data-dock=<name>] #dock` and `:root[data-rd-font=<name>]` rules. Each palette is its own `assets/css/deskbar/palettes/<name>.css`, a `:where(:root)[data-palette=<name>]` token set that head.html links before that stylesheet, and the CRT effects are `assets/css/deskbar/effects/crt.css`, linked last
- Page scripts work in windows: the shell re-runs a routed page's `<script>` elements in order, and holds their `load`/`DOMContentLoaded` listeners until the scripts finish. They run in global scope on every mount, so wrap top-level `let`/`const` in a block or IIFE.

### Extension points

From a site script (e.g. in `hooks/body-end.html`), in any load order:

```js
(window.deskbar ||= []).push(api => {
  // after page content and its scripts are in a window, including the first page
  api.onMounted(({ root, page, view }) => { /* render diagrams, maths, embeds */ });
  // each time a reader shows a page; the returned function runs before the next page and on close
  api.addReaderAddon(({ view, page, scroller, win }) => () => {}, { pages: false });
  // Back/Forward, before routing; return true if the hook restored the screen itself ({ first: true } to go first)
  api.onPop(key => false);
  // also: api.go(url) routes to a page; api.mountContent(root, page, view) runs page scripts and onMounted hooks;
  // api.loadLazy(name) loads an on-demand bundle, e.g. api.loadLazy('screensaver').then(m => m.start()), and
  // api.loaded() lists the ones loaded so far
  // visitor settings: api.settings.get(key), .set(key, value) (no value resets it), .on((key, value) => {}) returns an unsubscribe
  // keys: theme palette deco wall dock crt readerWidth readerFont textSize; api.settings.shown() is the theme on screen, light or dark
});
```

New window apps live in `assets/js/deskbar/apps/`: add a module that calls `defineApp({ kind, key, geometry, create, mount })` (contract in `apps/registry.js`) and import it from `apps/index.js`. Pages open in an app with `window: <kind>` in front matter.

Window size: pass `size: 'large'` instead of `geometry` for an application. Its window opens at 80% of the desk width and 90% of its height, starting right of the desktop icon column and centred in the room left. Tools, Photos, Terminal and Sketch use it. A page's `windowWidth`/`windowHeight` still override either. Phones show every window full screen.

#### Apps loaded on first open

Anything that isn't needed at start-up should load on demand so it stays out of the 45KB shell (`assets/js/deskbar/loader.js`). Each on-demand bundle has its own 12KB gzipped budget.

```text
assets/js/deskbar/lazy/<name>.js      # exports mount(view, page, opts); built to its own file
assets/css/deskbar/lazy/<name>.css    # optional, loaded before mount runs
content/<page>.md                     # front matter: window: <kind>
```

```js
// apps/index.js: the window opens at once with a loading note, then the bundle's mount takes over
lazyApp({ kind: 'about-desktop' });   // also name (defaults to kind), and key, geometry or size as in defineApp
lazyApp({ kind: 'terminal', size: 'large' });

// lazy/about-desktop.js
import { h } from '../lib/dom.js';   // lib/ helpers only; other shell modules hold state
export function mount(view, page, { fresh }) {
  if (!fresh) return;                 // fresh: first mount in this window
  const body = h('div', { class: 'scroller' }, ...page.content());
  view.el.append(body);
  window.deskbar.mountContent(body, page, view);   // the shell's functions come from window.deskbar
}

// a feature that isn't a window: the trigger lives in the shell, the rest loads on first use
loadLazy('context-menu').then(m => m.open(event));
```

A failed load, or a mount that throws, shows an error in the window, and opening the app again retries with a fresh mount. The About this desktop app (`lazy/about-desktop.js`) is a working example; Photos, Mail, Find in post, Sketch, Chiptunes, Feeds, the Terminal, the Control panel, the context menu, the screen savers and dragging posts out load the same way.

## Development

```sh
make serve    # example site with live reload
make build    # example site into .build/public
make test     # unit tests plus the size budgets (45KB shell, 12KB per on-demand bundle)
npm install && make e2e   # Playwright browser and axe accessibility tests against the example build
```

E2E environment variables:

- `SITE_DIR` tests another built site (a `public/` directory) and `BASE_URL` a running one, instead of the example build. Tests that need an example-only page skip when it is missing
- `AXE_ALL=1` makes the accessibility spec fail on minor and moderate axe findings too, not just serious and critical
- `CHROMIUM_PATH` uses an existing Chromium or headless shell
- `SHOTS_DIR` saves screenshots
- `ALIAS_PATH` is an alias URL on the site under test; `SCRIPT_PAGE` and `SCRIPT_SELECTOR` name a page whose scripts build its content
- `MERMAID_PAGE` is a page with a Mermaid flowchart, drawn for real with the self-hosted library

## Licence

MIT, except the Sheep screen saver's sprites (`static/vendor/esheep/gsheep-purple.png`): gSheep Purple by Oliver B., from Adriano Petrucci's [eSheep desktop pet](https://github.com/Adrianotiger/desktopPet), after Tatsutoshi Nomura's original eSheep. GPL-3.0, as [web-esheep](https://github.com/Adrianotiger/web-esheep). Details in `static/vendor/esheep/NOTICE.txt`.
