---
title: "Notes on Haiku's window tabs"
date: 2024-03-09T09:00:00+11:00
tags: ["design"]
categories: ["Engineering", "Retro"]
---

Haiku windows carry a yellow tab that can slide along the top edge. Dropping one tab onto another stacks the windows.

The gallery shortcode gives a post an album in Photos, however few pictures it has:

{{< gallery >}}
![A green gradient](/2025/11/keeping-javascript-small/photo-2.jpg)
![An orange gradient](/2025/11/keeping-javascript-small/photo-3.jpg)
{{< /gallery >}}

<!-- TODO: a note for the author, which stays out of the published markdown -->

A decorator draws the tab around the title:

```html
<div class="tab"><!-- the window's title goes here --></div>
```
