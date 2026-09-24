---
title: "Keeping JavaScript small"
date: 2025-11-02T09:00:00+11:00
tags: ["javascript", "performance"]
description: "A size budget keeps the shell honest."
thumbnail: photo-2.jpg
---

The shell has a 40KB gzipped budget for its JavaScript and CSS combined.

![A generated plasma image](photo-1.jpg)

![A green gradient](photo-2.jpg)

![An orange gradient](photo-3.jpg)

## Platform features first

Container queries, pointer events and `light-dark()` replace most of what a library would do.
