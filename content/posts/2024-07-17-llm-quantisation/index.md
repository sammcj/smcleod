---
title: "Understanding AI/LLM Quantisation Through Interactive Visualisations"
date: 2024-07-17T01:00:10+00:00
# weight: 1
# aliases: ["/first"]
tags: ["ai", "tools", "quantisation", "llm", "gguf", "dashboard"]
author: "Sam McLeod"
showToc: false
TocOpen: false
draft: false
hidemeta: false
comments: false
description: "AI/LLM Quantisation Visualised"
disableShare: false
disableHLJS: false
hideSummary: false
searchHidden: false
ShowReadingTime: false
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: false
ShowRssButtonInSectionTermList: true
UseHugoToc: false
mermaid: false
cover:
  image: ""
  alt: ""
  hidden: false
---

AI models ("LLMs" in this case) have inherently large sizes and computational requirements that often pose challenges for deployment and use.

Quantisation, a technique to reduce model size and memory footprint is often confusing for newcomers and understanding the trade-offs involved in the various quantisation types can be complex.

As a thought experiment and for my own learning, I've created an interactive dashboard to help myself and other users understand the impact of quantisation on LLMs.

This (_somewhat_) interactive dashboard aims to demystify LLM quantisation by providing visual representations of key metrics and trade-offs.

### _Disclaimer_

I am not a ML or data scientist. I am simply an engineer with an interest in AI. This project is a result of my personal interest in understanding the impact of quantisation on LLMs. The visualisations are based on my understanding of the subject and may not be 100% accurate or complete. I encourage you to verify the information presented here with other sources.

If you find errors - please do let me know! I want to correct my understanding and improve the visualisations over time.

The data is mainly focused on GGUF quantisation, however the visualisations can be used to understand other quantisation and model formats as well. I plan to add more quantisation techniques and models in the future.

<!--more-->

{{< quantisationDashboard >}}

### Perplexity vs Compression Chart

This chart illustrates the relationship between model compression and perplexity increase. It aims to help understand how different quantisation levels affect model quality and size reduction.

### Quantisation Spectrum Heatmap

This table provides a quick overview of various quantisation types, their relative sizes, qualities, and performance characteristics on different hardware (CUDA and Metal). It's for quickly comparing different quantisation options at a glance.

### Quantisation Sweet Spots

This table helps to identify the optimal quantisation level for different model sizes and VRAM constraints. It's useful for those working with specific hardware limitations.

### Quantisation Efficiency

These charts dive deeper into the efficiency of quantisation across different model sizes. They show how perplexity increase per GB saved changes with model size and quantisation.

### Decision Tree

This visual guide helps users navigate the decision-making process for selecting the most appropriate quantisation level based on their priorities (quality vs. size) and hardware constraints.

The dashboard is open source and available at: https://github.com/sammcj/quant/ and I welcome contributions and feedback.
