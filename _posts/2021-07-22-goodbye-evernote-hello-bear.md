---
title: Goodbye Evernote, Hello Bear
excerpt: "Moving on from Evernote after 14 years..."
date: '2021-07-22 19:00:00'
categories: software
author_url: "/author/sam"
published: false
draft: true
header:
  teaser: img/silvia/assembled_preview.jpeg
featured: true
tags:
  - software
---

I was a 14 year long Evernote subscriber, it served me well for the most part but in recent years Evernote went downhill to the point I now consider it hostile to it's users.

The native macOS app has been replaced with an Electron Javascript webframe, and like almost all Electron apps I've tried it was a pig of a thing - poor performance, memory and CPU hungry and that lacked low latency feeling native applications have.

The company also recently stopped people from being able to sync their notes offline - tough luck if you're travelling or don't have reliable internet access.

so I spent quite some time (weeks) testing out various alternatives including but not limited to Bear, Notion, Simplenote, ia writer, and a few other things.

## Requirements

My main requirements were:

- Web clipper for clipping the content of blog/forum posts, comments etc...
- Offline usage
- Cross device sync (multiple macOS based machines and my iPhone)
- Code block support
- Native application (strongly desired)
- Markdown support (strongly desired)

## Contenders

### Bear

For:

- Clean interface.
- Native application.
- Affordable ($22 AUD per year).
- Markdown support.

Against:

- Markdown only (At the time I thought it would be nice to have rich text with an option to have a note in markdown mode).
- On my first try importing my 3000~ notes and web clippings from Evernote caused the application to lag up and syncing to be slow, after some trial and error I narrowed it down to several web clippings with invalid HTML that were causing the application to lock up, after deleting these importing was not a problem.

### Notion

For:

- Advanced editor.
- Database like functionality.

Against:

- Lots of problems importing notes.
- Another Electron application.

## Screenshots

![](https://github.com/sammcj/smcleod_files/blob/master/images/evernote_bear/bear_header-mac-screenshot.jpeg?raw=true)
_image courtesy of [Bear](bear.io)_

![](https://github.com/sammcj/smcleod_files/blob/master/images/evernote_bear/bear_feature-themes.jpeg?raw=true)
_image courtesy of [Bear](bear.io)_

Web clipper

![](https://github.com/sammcj/smcleod_files/blob/master/images/evernote_bear/bear_web_clipper.jpeg?raw=true)
_image courtesy of [Bear](bear.io)_
