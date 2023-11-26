---
title: "Introduction to AI and Large Language Models (LLMs)"
author: "Sam McLeod"
description: 'A high level intro to LLMs that I'm writing for a few friends that are new to the concept. It is far from complete, definitely contains some errors and is a work in progress.'
categories: [ Tech, AI, LLM, WIP ]
keywords: ["tech", "ai", "llm", "wip"]
date: "2023-11-27T09:00:00Z"
images: [""]
featuredImagePreview:
tags:
- Tech
- LLM
- AI
- WIP
- DevOps
series: ["AI"]
hiddenFromHomePage: false
hiddenFromSearch: false
toc:
  enable: true
  auto: false
code:
  copy: true
  maxShownLines: 200
math: false
lightgallery: false
readingTime: true
showFullContent: true
asciinema: false
mermaid: false
draft: false
---

This is a high level intro to LLMs that I'm writing for a few friends that are new to the concept. It is far from complete, definitely contains some errors and is a work in progress.

**_This is a living document._**

Language models, or LLMs, are a type of artificial intelligence that can generate text based on a given prompt. They work by learning patterns in large amounts of text data and using those patterns to generate new text. LLMs can be used for a variety of tasks, such as generating chatbots, answering questions, and creating art.

<!-- more -->

## How Do LLMs Work?

LLMs work by analysing the patterns in the data they were trained on. When you ask an LLM a question or give it a prompt, it predicts the most likely response based on its training. (This is a massive over-simplification).

## Definition and Mechanism

LLMs are AI systems trained on extensive text datasets. They use a structure called a Transformer, which processes input text and predicts output based on learned patterns. For instance, if you input "The weather in Sydney is", the LLM, based on its training, might predict and complete it as "sunny and warm".

## Key Terminology

- **Quantisation**: Reducing the model size by decreasing the precision of its parameters, speeding up operation, different levels of quantisation result in different amounts of accuracy loss. Quantisation can speed up its operation without significant loss of accuracy. For example, converting a model's parameters from 32-bit floating-point to 16-bit, but most commonly people run Q4 (4 bit), Q5, Q6 or Q8 quantised models.

- **HuggingFace**: A platform offering and community collection of pre-trained models, adapters, LoRAs and training datasets.

- **Inference**: This is when the model generates a response to your input. For example, when you input a prompt, the model's inference process is what creates the output text.

- **Fine-Tuning**: Adjusting a pre-trained model to make it more suitable for specific tasks. For instance, you might fine-tune a model on a dataset of technical documents if you want it to generate technical content.

- **LoRA** (Low-Rank Adaptation): A technique to fine-tune models efficiently by only modifying a small part of the model's weights. This is useful for adapting a model to new tasks without extensive retraining.

- **Zero-Shot**: Providing a single prompt to the LLM to get a single response.

---

## Model Formats

### GPTQ

GPTQ stands for "generate predictive quantisation," which is a method for quantising the weights in an LLM that can be used to generate text.

GPTQ models can only be interferenced on GPUs.

### GGUF / GGML

GGML stands for "general-purpose generative model" and is a type of LLM that can be fine-tuned for specific tasks, such as language translation or chatbot generation. GGUF is the newer file extension for GGML models.

GGUF models can be interferenced on both CPU and GPU.

### AWQ

A newer model format (more information needed).

## Model Servers

Language model servers, or LLM servers, are software programs that allow you to run LLMs on your own server. There are several different types of LLM servers available, each with its own features and capabilities. In this guide, we will discuss the differences between some of the most commonly used LLM servers.

When using text generation web ui, ollama, lm_studio they will automatically select the correct model server. Text Generation WebUI lets you tune a lot of the parameters to get the most out of the LLMs and your hardware.

### autogptq

Note: Generally not used anymore, exllamav2 is preferred.

autogptq is an open-source LLM server that uses GPTQ as its quantisation method. It supports a wide range of LLMs, including Megatron-LM and Pegasus, and can be fine-tuned for specific tasks using Hugging Face's pre-trained models. autogptq is designed to be highly flexible and customisable, with support for GPU and CPU inference.

### llama.cpp

llama.cpp is a C++ implementation of an LLM that can be fine-tuned on your own data using the Hugging Face transformers library. It supports both GPGPU (General Purpose GPU Processing Unit) and CPU inference, and can be used to generate text for a wide range of tasks, including language translation and chatbot generation. llama.cpp is highly modular and can be easily integrated with other software programs.

### ctransformers

ctransformers is an open-source LLM server that uses the transformers library to run LLMs on your own server. It supports both GPU and CPU inference, and can be fine-tuned for specific tasks using Hugging Face's pre-trained models. ctransformers is highly flexible and customisable, with support for a wide range of LLMs and inference methods.

### autoAWQ

autoAWQ is an open-source LLM server that uses the Adaptive Weight Quantisation (AWQ) method to reduce the size of the model. It supports both GPU and CPU inference, and can be fine-tuned for specific tasks using Hugging Face's pre-trained models. autoAWQ is designed to be highly efficient and can reduce the size of the model by up to 90%.

### exllama

exllama is a Python-based LLM server that uses the AutoAWQ method to quantise the model. It supports both GPU and CPU inference, and can be fine-tuned for specific tasks using Hugging Face's pre-trained models. exllama is highly flexible and customisable, with support for a wide range of LLMs and inference methods.

### exllama_hf

exllama_hf is an open-source LLM server that uses the Hugging Face transformers library to run LLMs on your own server. It supports both GPU and CPU inference, and can be fine-tuned for specific tasks using Hugging Face's pre-trained models. exllama_hf is highly flexible and customisable, with support for a wide range of LLMs and inference methods.

---

## Prompting

### Tips for Good Prompts

- Be Specific: Clear and detailed prompts lead to better responses.
- Context Matters: Provide relevant background information, this is very important and often overlooked.
- Avoid Ambiguity: Make sure your prompt can't be misinterpreted.
- Chain of Thought Prompting: Break down a complex task into smaller steps in your prompt. For example, for a coding task, start with the problem definition, then outline the steps to solve it, and finally ask the model to generate code based on these steps.
- Zero-Shot vs Few-Shot Learning: These techniques involve giving the model either no examples (zero-shot) or a few examples (few-shot) to guide its response. For instance, you can provide a couple of examples of home automation commands and then ask the model to generate more.

### What to Avoid

- Overly Complex Requests: Keep it simple, especially at the beginning.
- Vague Language: Be as clear and direct as possible.

---

## Models

- Llama 2: An open-source base model that can be run locally for various tasks.
- Stable Diffusion: A set of base models for art generation.

## Common Open Source Tools

- [Text Generation Web UI](https://github.com/oobabooga/text-generation-webui): Interfaces for interacting with LLMs through a web browser. Has lots of plugins, extensions and APIs.
- [InvokeAI](https://invoke-ai.github.io/InvokeAI/): A web based open source tool for using LLM models for art generation.
- [Ollama](https://ollama.ai/): A cross-platform model server. Think of it like the docker client but for LLMs.

Note: [LM Studio](https://github.com/lmstudio-ai) is also a great app for macOS but it's not open source.

## CPU vs GPU Inference

CPU inference is the process of using an LLM to generate text by passing the prompt through the LLM's neural network on a central processing unit. This method is slower than GPU inference but requires less processing power and can be used on devices with limited memory, such as mobile devices. CPU inference can also be useful for running LLMs on devices that do not have a GPU or where GPU usage is not feasible due to power constraints.

GPU inference, on the other hand, is the process of using an LLM to generate text by passing the prompt through the LLM's neural network on a graphics processing unit. This method is faster than CPU inference and can be used to process large amounts of data at once. GPU inference requires more processing power than CPU inference and may not be suitable for devices with limited memory or where power usage is a concern.

### Model Offloading

Model offloading is the process of transferring an LLM from its original device, such as a server, to another device, such as a mobile phone, for faster processing. This can be done using various methods, including on-device inference and cloud-based inference. On-device inference involves running the LLM directly on the target device, while cloud-based inference involves running the LLM on a remote server and sending the results back to the client device.

Model offloading can be useful for devices that do not have enough processing power to run the LLM locally, or for applications where latency is a concern and faster processing is required. However, it may also introduce security risks, as sensitive data may be transferred over the network.

## Deep Dive into Key Terminology

- Tokenization: The process of converting text into tokens (small pieces) that the model can understand. For example, the sentence "Hello, World!" might be split into tokens like ["Hello", ",", "World", "!"].

- Embeddings: These are representations of tokens in a high-dimensional space. They capture the meaning and context of words, allowing the model to understand relationships between different tokens.

- Attention Mechanism: A part of the Transformer architecture that helps the model focus on relevant parts of the input when generating a response. It's like highlighting important words in a sentence to better understand its meaning.

---

## Interference Parameters

Common interference parameters are values that can be adjusted when using LLMs to control how much the model interferes with other processes on the same system.

These include the batch size, temperature, top_p/k and sequence length.

The learning rate controls how quickly the LLM updates its weights during training, the batch size determines how many examples the LLM processes at once during inference, and the sequence length determines the maximum length of text that the LLM can generate at once.

### max_new_tokens

max_new_tokens is a parameter that controls the maximum number of tokens that can be generated by the LLM during a single inference session. This parameter can be used to limit the length of the generated text or to control the amount of resources required for inference.

### temperature

temperature is a parameter that controls the randomness of the LLM's output. A higher temperature value will result in more random and unpredictable output, while a lower temperature value will result in more deterministic and predictable output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of creativity or diversity in the generated text.

### top_p

top_p is a parameter that controls the probability threshold for selecting the next token during inference. A higher value of top_p will result in more conservative output, while a lower value of top_p will result in more adventurous output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of risk or exploration in the generated text.

### min_p

min_p is a parameter that controls the minimum probability required for a token to be included in the generated text during inference. A higher value of min_p will result in more conservative output, while a lower value of min_p will result in more adventurous output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of risk or exploration in the generated text.

### top_k

top_k is a parameter that controls the number of most probable tokens that are considered during the inference process. A higher value of top_k will result in more conservative output, while a lower value of top_k will result in more adventurous output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of creativity or diversity in the generated text.

### repetition_penalty

repetition_penalty is a parameter that controls the penalty applied to repeating tokens during the inference process. A higher value of repetition_penalty will result in less repetitive output, while a lower value of repetition_penalty will result in more repetitive output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of creativity or diversity in the generated text.

### presence_penalty

presence_penalty is a parameter that controls the penalty applied to tokens that are already present in the generated text during the inference process. A higher value of presence_penalty will result in less repetitive output, while a lower value of presence_penalty will result in more repetitive output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of creativity or diversity in the generated text.

### frequency_penalty

frequency_penalty is a parameter that controls the penalty applied to tokens that appear frequently in the training data during the inference process. A higher value of frequency_penalty will result in less frequent output, while a lower value of frequency_penalty will result in more frequent output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of creativity or diversity in the generated text.

### repetition_penalty_range

repetition_penalty_range is a parameter that controls the range of possible values for the repetition penalty during the inference process. A higher value of repetition_penalty_range will result in more diverse output, while a lower value of repetition_penalty_range will result in more consistent output. This parameter can be used to fine-tune the LLM for specific tasks or to control the level of creativity or diversity in the generated text.

### epsilon_cutoff

epsilon_cutoff is a parameter that controls the threshold for early termination during inference. A higher value of epsilon_cutoff will result in more complete inferences, while a lower value of epsilon_cutoff will result in faster but potentially incomplete inferences. This parameter can be used to balance accuracy and speed during inference.

### eta_cutoff

eta_cutoff is a parameter that controls the threshold for early termination based on the number of tokens generated during inference. A higher value of eta_cutoff will result in more complete inferences, while a lower value of eta_cutoff will result in faster but potentially incomplete inferences. This parameter can be used to balance accuracy and speed during inference.
