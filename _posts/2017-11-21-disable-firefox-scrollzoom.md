---
title: Disable Firefox's zoom on mouse scroll
published: true
date: 2017-11-21
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-code
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