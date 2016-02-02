---
title: Limited Pagination in Jekyll with Liquid
layout: post
categories: []
date:   2015-02-15 10:37:00
---

I have another blog mondotunes.org which is a brain dump of whatever music I'm listening to and enjoying - I've recently (over night) switched from Wordpress to Jekyll.
Jekyll's default pagination is to show a list of all pages on your blog, which is pretty intrusive if you have a lot of pages:

![]({{ site.url }}/images/misc/pagenationbad.png)

So we need to set a range to limit on:

![]({{ site.url }}/images/misc/pagenationdiff.png)

Much better:

![]({{ site.url }}/images/misc/pagenationgood.png)