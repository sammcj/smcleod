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

No.
Ollama uses llama.cpp as it's inference engine, but provides a different set of features.

Someone made a claim the other day that Ollama was "just a llama.cop wrapper" my comment was as follows:

With llama.cpp running on a machine, how do you connect your LLM clients to it and request a model gets loaded with a given set of parameters and templates?

... you can't, because llama.cpp is the inference engine - and it's bundled llama-cpp-server binary only provides very basic server functionality (really more of demo/example) which is all configured at the time you run the binary and manually provide it command line args for the one specific model and configuration you start it with.

Ollama provides a server and client for interfacing and packaging models, such as:

- Hot loading models (e.g. when you request a model from your client Ollama will load it on demand).
- Automatic model parallelisation.
- Automatic model concurrency.
- Automatic memory calculations for layer and gpu/cpu placement.
- Layered model configuration (basically docker images for models).
- Templating and distribution of model parameters, templates in a container image.
- Near feature complete OpenAI compatible API as well as a native API.
- Native libraries for common languages.
- Official container images for hosting.
- Provides a client/server model for running remote or local inference servers with either ollama or openai compatible clients.
- Support for both an official and self hosted model and template repositories.

Ollama currently supports serving llama.cpp's GGUF, Vision LLMs that llama.cpp's example server does not and HF safetensors models, they are adding additional model backends which will be coming soon (e.g. things like exl2, awq, etc...).

Ollama is not "better" or "worse" than llama.cpp because it's completely different.

---
