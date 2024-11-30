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

## "Should I run a larger parameter model, or a higher quality smaller model of the same family?"

TLDR; **Larger parameter model [lower quantisation quality] > Smaller parameter model [higher quantisation quality]**

E.g: Qwen2.5 32B Q3_K_M > Qwen2.5 14B Q8_0

Caveats:

- Don't go lower than Q3_K_M, or IQ2_M, especially if the model is under 30B~ parameters.
- This is in the context of two models of the same family and version (e.g. Qwen2.5 Coder).

Longer answer: Check out the [Code Chaos and Copilots](https://smcleod.net/2024/07/code-chaos-and-copilots-ai/llm-talk-july-2024/) slide deck.

---

## "Should I use F16 quantised models to get the best quality output?"

TLDR; **No.**

For text generation running F16 models will do nothing other than waste your memory, compute, power and will respond slower.

Longer answer:

- Generally speaking you do not notice any improvements over around Q6_K.
- The larger the models parameter size, the less of an impact you'll see from lowering the quantisation quality.
- Very small models - below around 4B parameters are more affected by quantisation, try to keep those as high quality as possible up to Q8_0.
- If there is no larger parameter model in the family - don't go below Q4_K_M unless you really do not have the memory, or if the model is over around 50B parameters.
- Embeddings models are a bit different and are often kept at fp16, don't go lower than Q8_0.

---

## "Should I trust LLM generated code/content? What if the model makes a mistake? Don't they just make everything up?!"

TLDR; You know who else makes mistakes, writes bad code and makes things up? Humans.

Longer answer:

- You (generally) don't blindly trust code from other humans, if you do (and there we all do to a degree) you are accepting the risk that it may not be perfect.
  - If you took a hand full of random developers with different backgrounds and without providing any context you asked them to write a very specific piece of code, you would get a hand full of different implementations - much of it would be less than ideal if not outright incorrect.
  - If you first provided them with an education in the language you're working in, a specification, and information about the world - and your expectations - you would get a much better result. The same is true for LLMs. The time and effort it takes however to provide this to an LLM is far less.
- Just like with humans, you should should either:
  - Have systems in place to review and/or validate the outputs.
  - Or, Accept that the task and impact of undesired outcomes is low enough that you can accept the risk.

---

## "Will AI take my job?"

TLDR; Maybe.

Longer answer:

Capitalism sucks, hard.
It's the shitty card we've been dealt and because of that - for-profit companies will always be looking to reduce costs and increase profits. If this means they can reduce expenses by automating a role - they will (eventually).
To look at this another way - if the output of your job is repeatable and not creative - one could argue that (other than providing you income), it might also not be the best use of your time.

In the short term I think life will be very hard for many people not in a position to adapt, for-profit companies will continue to focus on profits over people, and governments will continue to be slow to act.

If I was to be cold about it - I would say something like "evolution isn't mandatory, but neither is survival".

In reality while there's a lot of nuance to this discussion, I think it's of the upmost importance to focus efforts on awareness, cross-skilling, re-skilling both yourself and those around you, and to push for a more equitable society where the benefits of automation are shared by all.

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
