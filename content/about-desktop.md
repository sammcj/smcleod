---
title: "About this desktop"
icon: "theme"
window: about-desktop
deskbarHidden: true
---

This site is a small desktop in the browser, built as my own Hugo theme in plain JavaScript and CSS with no framework. Posts, apps and tools open in windows you can drag, snap and stack. Hugo builds it as a static site, so every post keeps its own URL, its feed and a plain page that reads without JavaScript.

- The [Control panel](/control-panel/) swaps in other looks.
- The core shell is capped at 45KB gzipped. Everything else loads on first use.
- The source, theme included, is on [GitHub](https://github.com/sammcj/smcleod).

## How it was designed

- Three single-file prototypes came first: Deskbar Classic, Modern Tiles and Tracker Workbench. Deskbar Classic, a blend of Haiku and XFCE, became this site.
- The extra window styles were picked from a [sheet of twelve theme concepts](/design/theme-concepts.html), from NeXTSTEP and CDE to Phosphor and Broadsheet. Platinum, Clearlooks, Phosphor and Broadsheet are in the Control panel.

## Credits

- Look and feel after [Haiku](https://www.haiku-os.org/) (and BeOS before it) and [XFCE](https://xfce.org/)
- Built by [Hugo](https://gohugo.io/), with esbuild bundling the shell
- Diagrams by [Mermaid](https://mermaid.js.org/), loaded only on pages that use them
