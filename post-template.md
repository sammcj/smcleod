---
title:
date:
description:
tags:
image:
alt:
imageCaption:
featured:
comments:
showDate:
showTitle:
showShare:
norss:
nosearch:
toc:
showDate:
draft: true
aliases:
  - /posts/my-original-post-url/
---

## Theme specific front matter

title: the title of the article
date: usually automatically populated, holds the date and time of the post creation
description: a brief description of the post, useful for SEO optimization
tags: an array of tags, useful for searching similar articles
image: a link to a feature image for the article, shown in the preview as well
alt: alternative text to be shown if image is not available or fails to download
imageCaption: a markdown text rendered as a caption for the article image described above
featured: boolean, indicate if the post should be shown as featured
comments: boolean, if true it enables comments for the current post, if false it disables them (default is true)
showDate: boolean, true by default, if false hides the date. Useful for non-article pages where the date isn't important
showTitle: boolean, true by default, if false hides the title.
showShare: boolean, true by default, if false hides the share button.
norss: boolean, if set to true the page will be skipped in the rss feed
nosearch: boolean, if set to true the page won't show up in searches
toc: boolean, if set to true a table of contents will be shown for the article

## Standard hugo front matter

publishDate: date, if set the post will be published at the specified date, otherwise it will be published immediately
aliases: an array of aliases, useful for redirecting old urls to the new ones
draft: boolean, if set to true the post will be skipped in the build process
series: string, if set the post will be shown as part of a series, the value should be the name of the series
videos: an array of videos, useful for embedding videos in the article
audio: an array of audio, useful for embedding audio in the article
summary: a brief summary of the post, useful for SEO optimization
lastmod: date, if set the post will be shown as modified at the specified date, otherwise it will be shown as modified at the post creation date
layout: string, if set to "post" the post will be shown as a post, otherwise it will be shown as a page
headless: boolean, if set to true the post will be skipped in the build process
expiryDate: date, if set the post will be skipped in the build process after the specified date
cascade: boolean, if set to true the post will be skipped in the build process
