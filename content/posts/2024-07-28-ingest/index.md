---
title: "Ingest: Streamlining Content Preparation for LLMs"
date: 2024-07-29T01:00:10+00:00
tags: ["ai", "tools", "llm", "tech", "cli", "golang", "automation"]
author: "Sam McLeod"
showToc: true
TocOpen: false
draft: false
hidemeta: false
comments: false
description: "A CLI tool for parsing directories into LLM-friendly markdown"
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
  image: "https://raw.githubusercontent.com/sammcj/ingest/main/screenshot.png"
  alt: "Ingest CLI Screenshot"
  hidden: false
---

[Ingest](https://github.com/sammcj/ingest/) is a tool I've written to make life easier when preparing content for LLMs.

Ingest is a command-line tool that does the heavy lifting of parsing directories full of plain text files (think source code, documentation, etc.) into a single, coherent markdown file. It's designed to aid the process of feeding code or text into an LLM but don't want to spend a lot of time copying and pasting.

![Ingest CLI Screenshot](https://raw.githubusercontent.com/sammcj/ingest/main/screenshot.png)

## Key Features

- **Directory Traversal**: Walks through your file structures and generates a neat tree view.
- **Flexible File Selection**: Include or exclude files using glob patterns.
- **Git Integration**: Generate diffs and logs to capture changes.
- **Token Counting**: Gives you an approximate token count for LLM compatibility.
- **Customizable Output**: Use templates to format the output just how you like it.
- **Clipboard Integration**: Automatically copies the output to your clipboard (where available).
- **Multiple Output Options**: Export to a file, print to console, or even output as JSON.

## Getting Started

### Installation

The easiest way to get ingest is via `go install`:

```shell
go install github.com/sammcj/ingest@HEAD
```

Or, if you prefer, grab a pre-built binary from the [releases page](https://github.com/sammcj/ingest/releases).

## Basic Usage

Using ingest is as simple as:

```shell
ingest [flags] <path>
```

Running `ingest` with no parameters will parse current directory:

```shell
$ ingest

⠋ Traversing directory and building tree...  [0s] [i] 9741 Tokens (Approximate)
[✓] Copied to clipboard successfully.
```

### Examples

Generate a prompt from a directory, including only Python files:

```shell
ingest -i "**/*.py" /path/to/project
```

Include a git diff and copy to clipboard:

```shell
ingest -d /path/to/project
```

Save the output to a file:

```shell
ingest -o output.md /path/to/project
```

## Configuration

Ingest uses the following directories for user-specific settings:

- `~/.config/ingest/patterns/exclude`: For additional exclude patterns.
- `~/.config/ingest/patterns/templates`: For custom output templates.

These directories are created automatically on first run, complete with README files explaining their purpose.

### Excludes

You can see the default excludes by running:

```shell
ingest --print-default-excludes
```

To override these, just create a `default.glob` file in `~/.config/ingest/patterns/exclude`.

### Templates

Templates use standard [go templating syntax](https://pkg.go.dev/text/template).

You can view the default template with:

```shell
ingest --print-default-template
```

To use your own default template, create a `default.tmpl` file in `~/.config/ingest/patterns/templates`.

## Wrapping Up

Ingest is a daily time-saver for me when working with LLMs.

The code is open source and available on [Github](https://github.com/sammcj/ingest/).

As always, if you find any bugs or have ideas for improvements, don't hesitate to open an issue or submit a PR.

Happy ingesting!
