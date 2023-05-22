---
title: "How likely would you be to block a company from asking you to rate everything they do?"
subtitle: "NPS Surveys are corporate spam"
date: 2023-05-26T06:41:37
lastmod: 2023-05-26T19:41:37
author: Sam McLeod
description: "NPS Surveys are corporate spam"
keywords: ["NPS", "Surveys", "Marketing", "Spam", "Sales", "Customer Experience", "Email"]
tags: ["Sales", "Marketing", "Customer Experience", "Email", "Spam"]
categories: ["Sales/Marketing", "Enterprise"]
series: []
images: ["time-based-estimates.png"] # TODO:
# featuredimage: "time-based-estimates.png"
featuredImagePreview: "time-based-estimates.png"
hiddenFromHomePage: false
hiddenFromSearch: false
toc:
  enable: true
  auto: false
code:
  copy: true
  maxShownLines: 20
math: false
lightgallery: false
readingTime: false
showFullContent: false
asciinema: false
mermaid: true
draft: false
---

- "How likely would you be to recommend us to a friend or colleague?"
- "Rate our service from 1-10"
- "How did we do?"
- "How was your experience?"

These questions seem to be everywhere these days, in some places you can't even buy a coffee without being asked to rate the service.

NPS stands for Net Promoter Score, companies use this to measure customer satisfaction and make their customers feel like they listened to and that their opinion matters.

> It's a simple question, and it's a simple score. It's also a simple way to annoy your customers and get your emails all filtered to the spam folder.

Below is a gross, but effective [Sieve](http://sieve.info/) script that (rather unintelligently) filters out NPS surveys from your inbox and moves them to a folder of your choice.

This script should work with any mail service / server that supports standard Sieve scripts, I use this with [Fastmail](https://fastmail.com) _(or if you feel like it you can optionally use [my referral link](https://ref.fm/u13738357)_).

{{<github repo="sammcj/scripts" file="email/customer-satisfaction-spam.sieve" lang="sieve" options="linenos=table">}}
[Click here to find the latest version](github.com/sammcj/scripts/email/customer-satisfaction-spam.sieve) of this script.

Fastmail offers a [Sieve testing tool](https://app.fastmail.com/sievetester/) you can use to test your script before you apply it to your account.
