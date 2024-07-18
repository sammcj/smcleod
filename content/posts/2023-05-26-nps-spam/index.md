---
title: "How likely would you be to block a company from asking you to rate everything they do?"
subtitle: "Very, it turns out..."
date: 2023-05-26T06:41:37
lastmod: 2023-05-26T19:41:37
author: Sam McLeod
description: "NPS Surveys are corporate spam"
keywords: ["NPS", "Surveys", "Marketing", "Spam", "Sales", "Customer Experience", "Email", "NPS"]
tags: ["Sales", "Marketing", "Customer Experience"]
categories: ["Sales/Marketing", "Enterprise"]
series: []
images: ["i-dont-use-nps-1.jpg"]
# featuredimage: "i-dont-use-nps-1.jpg"
cover:
  image: "i-dont-use-nps-1.jpg"
  #alt: "<alt text>"
  #caption: "<text>"
  #relative: false # To use relative path for cover image, used in hugo Page-bundles
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


## I'm tired of getting emails from companies asking me to rate their products and services

It feels like you can't even buy a coffee these days without being asked if you would recommend the coffee shop to a friend or colleague.
<!--more-->

- "How likely would you be to recommend us to a friend or colleague?"
- "Rate our service from 1-10"
- "How did we do?"
- "How was your experience?"

> It's a simple question, and it's a simple score.
>
> It's also a simple way to annoy your customers and end up in their spam folder.

---

## What is NPS?

NPS stands for **N**et **P**romoter **S**core.

The idea is that you ask your customers to rate your product, service or experience from 0-10, and then you subtract the percentage of detractors (0-6) from the percentage of promoters (9-10) to get your NPS score. For example, if 50% of your customers are promoters and 10% are detractors, your NPS is 40.

Companies like to use _(abuse?)_ this to measure customer satisfaction and make their customers feel like they listened to and that their opinion matters.

There are many problems with this highly reductive and impersonal MBE style approach but the one that annoys me the most is that it's essentially created a new form of corporate spam.

---

I've had a crack at writing some advanced email rules to filter these out to a folder - it's far from perfect but it's a start.

The following [Sieve](http://sieve.info/) script (rather unintelligently) filters out NPS surveys from a combination of keywords in the body and headers and moves them from your inbox to a folder of your choice.

This script should work with any mail service / server that supports standard Sieve scripts, I use this with [Fastmail](https://fastmail.com) _(or if you feel like it you can optionally use [my referral link](https://ref.fm/u13738357)_).

Fastmail offers a [Sieve testing tool](https://app.fastmail.com/sievetester/) you can use to test your script before you apply it to your account.

[Click here to find the latest version](https://github.com/sammcj/scripts/blob/master/email/customer-satisfaction-spam.sieve) of this script and _please_ do raise PRs to improve it!

There's plenty of room for improvement here, e.g.:

- Additional matching keywords / phrases.
- Check if sender is in your address book (Not currently possible with Fastmail's Sieve extensions).
- Use an upstream list of keywords, phrases and domains rather than hardcoding them (Not sure if this is possible with Sieve?).
- Automate updating the ruleset.

## Links

- [NPS Considered Harmful](https://jmspool.medium.com/net-promoter-score-considered-harmful-and-what-ux-professionals-can-do-about-it-fe7a132f4430)
- [Reasons to use NPS](https://www.npsistheworst.com/reasons-to-use-nps) (also credit to this site for the image used in this post)
- [NPS is hurting you](https://uxdesign.cc/this-popular-business-metric-is-hurting-you-55ed535e9a59)
- [Sieve testing tool](https://app.fastmail.com/sievetester/) (Fastmail)
- [Sieve](http://sieve.info/)
