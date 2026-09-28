---
title: "About this desktop"
icon: "theme"
window: about-desktop
deskbarHidden: true
---

This site is a small desktop in the browser, built as my own Hugo theme in plain JavaScript and CSS with no framework. Posts, apps and tools open in windows you can drag, snap and stack. Hugo builds it as a static site, so every post keeps its own URL, its feed and a plain page that reads without JavaScript.

I've enjoyed trying out window management ideas along the way. Grab a window by its title tab and drop it on another window's tab, and the two stack into one tabbed window. Drag a tab away to pull it back out. Drop it on the side edge of another window instead and the two join side by side, moving together until you press the clip between them. Drag a window to a screen edge to snap it, press `a` to tile every open window, or drag a post out of the Posts window to open it on its own.

- The [Control panel](/control-panel/) swaps in other looks.
- The core shell is capped at 45KB gzipped. Everything else loads on first use.
- The source, theme included, is on [GitHub](https://github.com/sammcj/smcleod).

## How it was designed

- Three single-file prototypes came first: Deskbar Classic, Modern Tiles and Tracker Workbench. Deskbar Classic, a blend of Haiku and XFCE, became this site.
- The name comes from the Deskbar, the menu and task panel of BeOS and Haiku, whose look the first style follows.
- When adding new styles I build prototypes of the candidates to pick from. This [sheet of twelve theme concepts](/design/theme-concepts.html), from NeXTSTEP and CDE to Phosphor and Broadsheet, is one example.

## Credits

- The first look was modelled on [Haiku](https://www.haiku-os.org/) (and BeOS before it). Others, such as the [XFCE](https://xfce.org/)-like and Synthwave looks, came later, and more will follow.
- Built by [Hugo](https://gohugo.io/), with esbuild bundling the shell
- Diagrams by [Mermaid](https://mermaid.js.org/), loaded only on pages that use them
- The [sheep screen saver](/screensaver/) is eSheep, the 1990s desktop pet by Tatsutoshi Nomura that used to wander across my screen back in the day, drawn with the gSheep Purple sprites from [Adriano Petrucci's desktopPet](https://github.com/Adrianotiger/desktopPet)
