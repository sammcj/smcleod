---
title: "Gollama: Ollama Model Manager"
date: 2024-06-01T01:00:10+00:00
# weight: 1
# aliases: ["/first"]
tags: ["Markdown", "Go", "Golang", "Ollama", "AI", "LLM", "LMStudio"]
author: "Sam McLeod"
showToc: true
TocOpen: false
draft: false
hidemeta: false
comments: false
description: "Gollama is a Go-based client for Ollama for managing models."
# canonicalURL: "https://canonical.url/to/page"
disableShare: false
disableHLJS: false
hideSummary: false
searchHidden: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowRssButtonInSectionTermList: true
UseHugoToc: true
mermaid: true
cover:
  image: "gollama-v1.0.0.jpg"
  alt: "Gollama TUI"
  hidden: false
---

- [Gollama on Github](https://github.com/sammcj/gollama)

Gollama is a client for Ollama for managing models.
It provides a TUI for listing, filtering, sorting, selecting, inspecting (coming soon!) and deleting models and can link Ollama models to LM-Studio.

The project started off as a rewrite of my [llamalink](https://smcleod.net/2024/03/llamalink-ollama-to-lm-studio-llm-model-linker/) project, but I decided to expand it to include more features and make it more user-friendly.

![](gollama-v1.0.0.jpg)

<!--more-->

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Features](#features)
- [Usage](#usage)
  - [Inspect](#inspect)
  - [Top](#top)
  - [Simple model listing](#simple-model-listing)
  - [Key Bindings](#key-bindings)
    - [Command-line Options](#command-line-options)
- [Configuration](#configuration)
- [Installation and build from source](#installation-and-build-from-source)
- [Logging](#logging)
- [License](#license)

## Features

- Interactive TUI with sorting and filtering capabilities.
- List available models and display basic metadata such as size, quantization level, model family, and modified date.
- Sort models by name, size, modification date, quantization level, and family.
- Select and delete models.
- Inspect model for additional details.
- Link models to LM Studio.
- Copy models.
- Push models to a registry.
- Show running models.
- Plenty more comings soon if I continue to find the tool useful.

From go:

```shell
go install github.com/sammcj/gollama@HEAD
```

From Github:

Download the most recent release from the [releases page](https://github.com/sammcj/gollama/releases) and extract the binary to a directory in your PATH.

e.g. `zip -d gollama-v1.8.1.zip -d gollama && mv gollama /usr/local/bin`

## Usage

To run the `gollama` application, use the following command:

```sh
gollama
```

_Tip_: I like to alias gollama to `g` for quick access:

```shell
echo "alias g=gollama" >> ~/.zshrc
```

### Inspect

![](https://github.com/sammcj/gollama/blob/main/screenshots/gollama-inspect.png?raw=true)

### Top

![](https://github.com/sammcj/gollama/blob/main/screenshots/gollama-top.jpg?raw=true)

### Simple model listing

Gollama can also be called with `-l` to list models without the TUI.

```shell
./gollama -l
```

![](https://github.com/sammcj/gollama/blob/main/screenshots/cli-list.jpg?raw=true)

### Key Bindings

- `Space`: Select
- `Enter`: Run model (Ollama run)
- `i`: Inspect model
- `t`: Top (show running models)
- `D`: Delete model
- `c`: Copy model
- `u`: Update model (edit Modelfile) **Work in progress**
- `P`: Push model
- `n`: Sort by name
- `s`: Sort by size
- `m`: Sort by modified
- `k`: Sort by quantization
- `f`: Sort by family
- `l`: Link model to LM Studio
- `L`: Link all models to LM Studio
- `q`: Quit

#### Command-line Options

- `-l`: List all available Ollama models and exit
- `-ollama-dir`: Custom Ollama models directory
- `-lm-dir`: Custom LM Studio models directory
- `-no-cleanup`: Don't cleanup broken symlinks
- `-cleanup`: Remove all symlinked models and empty directories and exit
- `-v`: Print the version and exit

## Configuration

Gollama uses a JSON configuration file located at `~/.config/gollama/config.json`. The configuration file includes options for sorting, columns, API keys, log levels etc...

Example configuration:

```json
{
  "default_sort": "modified",
  "columns": [
    "Name",
    "Size",
    "Quant",
    "Family",
    "Modified",
    "ID"
  ],
  "ollama_api_key": "",
  "ollama_api_url": "http://localhost:14434",
  "lm_studio_file_paths": "",
  "log_level": "info",
  "log_file_path": "gollama.log",
  "sort_order": "Size",
  "strip_string": "my-private-registry.internal/"
}
```

The strip string option can be used to remove a prefix from model names as they are displayed in the TUI.
This can be useful if you have a common prefix such as a private registry that you want to remove for display purposes.

## Installation and build from source

1. Clone the repository:

    ```shell
    git clone --depth=1 https://github.com/sammcj/gollama.git
    cd gollama
    ```

2. Build:

    ```shell
    go get
    make build
    ```

3. Run:

    ```shell
    ./gollama
    ```

## Logging

Logs can be found in the `gollama.log` which is stored in `$HOME/.config/gollama/gollama.log` by default.
The log level can be set in the configuration file.

## License

Copyright © 2024 Sam McLeod

This project is licensed under the MIT License.
