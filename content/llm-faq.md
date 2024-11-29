---
title: "LLM FAQ"
description: "Frequently Asked Questions about LLMs and AI"
aliases: ["llm", "faq", "frequently-asked-questions","llm-faq","ollama-faq"]
tags: ["ai", "tools", "llm", "tech", "llms", "ollama","llama","faq","ollama faq","llm faq"]
author: "Sam McLeod"
norss: false
comments: false
showDate: true
subtitle: "Frequently Asked Questions about LLMs and AI"
hidemeta: false
readingTime: true
ShowReadingTime: true
ShowWordCount: false
ShowBreadCrumbs: true
ShowPostNavLinks: true
mermaid: true
disableShare: false
disableHLJS: false
UseHugoToc: false
hideSummary: false
ShowRssButtonInSectionTermList: true
# cover:
#   image: "diagram-gen.png"
#   alt: "DiagramGen"
#   hidden: false
toc:
  enable: true
  auto: true
draft: false
---

<!-- markdownlint-disable MD025 -->

## Ollama

### "Is Ollama just a wrapper for Llama.cpp?"

TLDR; No.
Ollama uses llama.cpp as it's primary inference engine, but provides a different set of features.

---

On several occasions I have come across the claim that _"Ollama is just a llama.cpp wrapper"_, which is inaccurate and completely misses the point. I am sharing my response here to avoid repeating myself repeatedly.

With llama.cpp running on a machine, how do you connect your LLM clients to it and request a model gets loaded with a given set of parameters and templates?

... you can't, because llama.cpp is the inference engine - and it's bundled llama-cpp-server binary only provides relatively basic server functionality - it's really more of demo/example or MVP.

Llama.cpp is all configured at the time you run the binary and manually provide it command line args for the one specific model and configuration you start it with.

Ollama provides a server and client for interfacing and packaging models, such as:

- Hot loading models (e.g. when you request a model from your client Ollama will load it on demand).
- Automatic model parallelisation.
- Automatic model concurrency.
- Automatic memory calculations for layer and GPU/CPU placement.
- Layered model configuration (basically docker images for models).
- Templating and distribution of model parameters, templates in a container image.
- Near feature complete OpenAI compatible API as well as it's native native API that supports more advanced features such as model hot loading, context management, etc...
- Native libraries for common languages.
- Official container images for hosting.
- Provides a client/server model for running remote or local inference servers with either Ollama or openai compatible clients.
- Support for both an official and self hosted model and template repositories.
- Support for multi-modal / Vision LLMs - something that llama.cpp is not focusing on providing currently.
- Support for serving safetensors models, as well as running and creating models directly from their Huggingface model ID.

In addition to the llama.cpp engine, Ollama are working on adding additional model backends (e.g. things like exl2, awq, etc...).

Ollama is not "better" or "worse" than llama.cpp because it's an entirely different tool.

---
