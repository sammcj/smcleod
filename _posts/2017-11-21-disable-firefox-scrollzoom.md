---
title: Disable Firefox's zoom on mouse scroll
date: 2017-11-21
categories: tech
layout: post
author_url : /author/sam
image: img/backdrop-code.jpg
---

This annoys me endlessly, so in `about:config`:

```
mousewheel.with_control.action 0
mousewheel.with_meta.action 0
```

And if you use Firefox Sync and want those settings to sync between your devices also add:

```
services.sync.prefs.mousewheel.with_meta.action true
services.sync.prefs.sync.mousewheel.with_control.action true
```
