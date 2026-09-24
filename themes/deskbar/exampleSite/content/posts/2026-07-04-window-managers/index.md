---
title: "Window managers in the browser"
date: 2026-07-04T09:00:00+10:00
tags: ["web", "design"]
series: ["Deskbar"]
categories: ["Engineering"]
description: "How a static site can act like a desktop without a framework."
cover:
  image: "cover.jpg"
aliases: ["/old/window-managers/"]
---

A window manager needs surprisingly little code: a list of windows, a z-order counter and pointer events.

## Windows as plain objects

Each window is a plain object with a position, a size and the views it holds. Rendering applies that state to an absolutely positioned element.

## Snapping

Dragging a window to the left or right edge snaps it to half the desktop. Corners give quarters and the top edge maximises.

### Shared divider

Two windows snapped side by side share one divider, so resizing one resizes the other.

## Focus

Clicking a window raises it above the rest. Unfocused windows get a muted tab.

```js
function focus(win) {
  win.z = ++state.z;
}
```
