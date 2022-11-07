---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2018-07-30T08:52:00Z"
aliases:
  - /tech/2018/07/30/background-youtube-dl
images: ["camera-background.jpg"]
featuredImagePreview: camera-background.jpg
tags:
- tech
- software
title: Run youtube-dl (or similar) in the background
---

I wanted an alias or function to use [`youtube-dl`](https://rg3.github.io/youtube-dl/) in the background.
Looking around the web lots of people seemed to want this and most of them were banging their heads against a wall due to:

- A) bash quoting
- B) backgrounding dying when their terminal closed
- C) passing the argument (url in my case) to the function

Here's a simple function I whipped up that seems to 'just works'™:

```bash
function yt
{
  nohup youtube-dl "$1" --no-progress 2>&1 > youtube-dl-"$(date +%Y%m%d-%H%M%S)".log &
}
```

And if you don't want logs, simply send the output to `/dev/null`:

```bash
function yt
{
  nohup youtube-dl "$1" --no-progress 2>&1 > /dev/null &
}
```

Example:

```shell
yt 'https://www.youtube.com/watch?v=fK0qwngdNgw`
```

...and you can continue on with other work, queue up more downloads or even close the terminal session.

The resulting output looks as such:

```shell
~ ls
Jimmy Licks-fK0qwngdNgw.mp4
youtube-dl-20180730-085025.log
```

The log file contains the usual [`youtube-dl`](https://rg3.github.io/youtube-dl/) information:

```shell
~ cat youtube-dl-20180730-085025.log

[youtube] fK0qwngdNgw: Downloading webpage
[youtube] fK0qwngdNgw: Downloading video info webpage
[youtube] fK0qwngdNgw: Downloading js player vflE6swsi
[youtube] fK0qwngdNgw: Downloading MPD manifest
[youtube] fK0qwngdNgw: Downloading MPD manifest
[dashsegments] Total fragments: 8
[download] Destination: Jimmy Licks-fK0qwngdNgw.f137.mp4
[download] 100% of 15.84MiB in 00:10.04MiB/s ETA 00:0002:39
[dashsegments] Total fragments: 5
[download] Destination: Jimmy Licks-fK0qwngdNgw.f140.m4a
[download] 100% of 564.58KiB in 00:01.31MiB/s ETA 00:00:12
[ffmpeg] Merging formats into "Jimmy Licks-fK0qwngdNgw.mp4"
Deleting original file Jimmy Licks-fK0qwngdNgw.f137.mp4 (pass -k to keep)
Deleting original file Jimmy Licks-fK0qwngdNgw.f140.m4a (pass -k to keep)
```
