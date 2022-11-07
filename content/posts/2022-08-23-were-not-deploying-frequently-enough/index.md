---
author: "Sam McLeod"
readingTime: true
categories: [ ml, DevOps ]
date: "2022-08-23T07:00:00Z"
aliases:
  - /DevOps/2022/08/23/were-not-deploying-frequently-enough/
images: ["nick-abrams-FTKfX3xZIcc-unsplash.jpg"]
featuredImagePreview: nick-abrams-FTKfX3xZIcc-unsplash.jpg
tags:
- DevOps
- software development
- agile
- enterprise
- machinelearning
title: It's 2022 and we're (still) not deploying enough
---

{{< admonition "This blog post is an experiment" >}}
This post was written using Machine Learning (GPT3) with minimal intervention from me beyond providing prompts and sources.
{{< /admonition >}}

## We're (still) not deploying enough

It's 2022 and not deploying frequently enough is *still* one of the most common causes of software failure.

I couldn't tell you how often I work with clients that have deployment problems and it turns out they haven't deploy the code in production for weeks, sometimes months, or in a few cases years.

Sometimes it's because they're afraid of change, sometimes it's due to a lack of resources, but more often than not it's due to fear of the unknown. But you know what? **If you're not deploying your code, then you have no idea if it works or not**.

Do you want to know if your code works? Deploy it in production! The more you deploy, the better you'll get at it. And what happens when you get good at something? You get really good at it. You'll be able to deploy code faster, more often and with less bugs than ever before.

## Mean Time To Change matters

The Mean Time To Change (MTTC) metric is one of the most important metrics in software engineering. It measures how long it takes to deploy a change, which can be used as a measure of quality.

Time spent on testing and deployment will be saved by reducing MTTC, which means more time for other tasks like building products or improving processes. In fact, deploying often is a key part of any DevOps strategy because it helps reduce costs associated with deployment errors and keeps them from happening too often.

It's important to note that MTTC doesn't mean anything if you don't have a robust way of determining how often your team releases software. If it takes an hour for someone on your team to deploy changes and another half-hour before everyone else can verify them, then even though they may be deploying every day, they're still not deploying fast enough because there's no guarantee that the code will be released in production within 24 hours.

People have been talking about the importance of MTTC for decades. I'm a big fan of the work that the DevOps movement has done in this area, but there's still so much more that needs to be done. It's time we start thinking about MTTC at every level from individual engineers to entire companies.

- [The 4 key DevOps metrics for organisational performance](https://cloud.google.com/blog/products/DevOps-sre/using-the-four-keys-to-measure-your-DevOps-performance).
- [MTTC - Wikipedia](https://en.wikipedia.org/wiki/Mean_time_to_change).

## Why some companies (usually large enterprises) are afraid of deploying daily - and why they're wrong

The first group that I want to address are the large, more traditional enterprises. These companies have a lot of reasons for not deploying frequently enough: fear of change, lack of resources and time amongst them. They're wrong in thinking deploying less means less problems.

Research from Accelerate and The State of DevOps shows that enterprises deploy more frequently correlate highly with their software having far less bugs, teams having improved productivity and as a result a more competitive product offering.

Daily deployments help you catch problems early on when they're easier to fix than later down the line when it's harder to fix—and if you can't fix them then there's no way you can prevent bugs from happening again!

That's why it's so important for all developers not just those at startups who are used to working this way but also those at large enterprises and even their managers! Daily deployments, when done right and with the proper tools, can help everyone get better at what they do.

## Convincing your team - and the business

This can sometimes be a challenge, especially at slow moving, traditional enterprises. But like anything it's hard to convince someone that they should do something if they've never done it before (and have no idea how to do it).

This is where you come in: You can show them what it's like when you're deploying your code frequently, and the benefits that come from doing so. The first thing to do is make them understand that there are benefits to deploying code frequently.

It's not just good for developers, it's also good for business. Why? Because faster deployments means less bugs, lower support costs and happier customers! Once they understand this, then they can start thinking about how they might do it themselves.

There are two common ways to approach this.

### Approach A - Showcase what good looks like

Start small, pick a modern or at least recently developed application, and show them how it's done. This can be a great way to get started, make sure your project is visible to everyone internally or better yet - open source it! This is a great way to get people excited about how they can use it, how quickly they can deploy and how easy it is to get started.

### Approach B - Get everyone on board with the idea of deploying code frequently

It's hard for developers to adopt this mindset if they aren't encouraged by their managers or business owners. So, talk to your management about it and let them know how important it is that you get buy-in from them.

The next step is to figure out how you're going to do it.

- How are you going to deploy your code frequently?
- What tools do you need?
- Do you have a staging environment already in place? If not, then now is the time to set one up!

This approach can work if there is a lot of trust between management and developers, but can take a significant time if there is little trust, motivation or engagement.

### What does bad look like

In addition to either of these approaches - make sure you showcase what bad looks like

- What does it mean to be bad at deploying software and how has that manifested in your organisation?
- What are some of the impacts of not being good at deploying software?
- How often do things fail and how much time does it take to recover from these failures?
- How do you currently know if something is failing?
- How do you currently know if something is *working*?
- What's the cost? (This can be difficult to figure out, sometimes estimates are good enough).

You may be surprised by what you find!

## Conclusion

It's critical to do your due diligence and make sure that you're deploying frequently enough. You want to be confident that your app is ready when it's needed, so that customers don't have to wait for you or suffer from any problems.

If you find yourself struggling with this issue, consider hiring a consultant or coach who can help guide you through the process of continuously improving your development practices, making it easier for them to work together effectively on current and future projects as well!

### References

- [DORA - DevOps Research and Analysis](https://www.DevOps-research.com/research.html)
- [Accelerate: The Science of Lean Software and DevOps](https://itrevolution.com/book/accelerate/)
- [The Phoenix Project](https://itrevolution.com/the-phoenix-project/)
- [The DevOps Handbook](https://itrevolution.com/the-DevOps-handbook/)
- [2021 Accelerate State of DevOps Report](https://cloud.google.com/blog/products/DevOps-sre/announcing-dora-2021-accelerate-state-of-DevOps-report)
- [2019 DORA Accelerate State of DevOps Report](https://cloud.google.com/blog/products/DevOps-sre/the-2019-accelerate-state-of-DevOps-elite-performance-productivity-and-scaling)
