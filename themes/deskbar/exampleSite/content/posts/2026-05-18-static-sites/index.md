---
title: "Static sites with real URLs"
date: 2026-05-18T09:00:00+10:00
tags: ["web", "hugo"]
series: ["Deskbar"]
description: "Every window state has a crawlable page behind it."
cover: "cover.png"
---

Every route is a prerendered HTML page. Without JavaScript it reads as a normal document.

## Loading pages into windows

The shell fetches the next page, extracts its main element and places it in the right window.

## History

The address bar tracks what is open, so Back and Forward work as expected.

## Standalone tools

Static HTML files open in a tool window too: the [demo tool file](/tools/demo.html) opens its tool page, and a [file with no tool page](/tools/stopwatch.html) gets a window of its own.
