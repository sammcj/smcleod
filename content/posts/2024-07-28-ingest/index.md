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

[Ingest](https://github.com/sammcj/ingest/) is a tool I've written to make my life easier when preparing content for LLMs.

It parses directories of plain text files, such as source code, documentation etc... into a single markdown file suitable for ingestion by AI/LLMs.

![Ingest CLI Screenshot](https://raw.githubusercontent.com/sammcj/ingest/main/screenshot.png)

## Key Features

- **Directory Traversal**: Walks through your file structures and generates a neat tree view.
- **Flexible File Selection**: Include or exclude files using glob patterns.
- **Ollama Integration**: Parse output directly to Ollama for processing.
- **Git Integration**: Generate diffs and logs to capture changes in the output.
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

Basic usage:

```shell
ingest [flags] <paths>
```

ingest will default the current working directory, if no path is provided, e.g:

```shell
$ ingest

⠋ Traversing directory and building tree...  [0s] [i] 9741 Tokens (Approximate)
[✓] Copied to clipboard successfully.
```

Generate a prompt from a directory, including only Python files:

```shell
ingest -i "**/*.py" /path/to/project
```

Generate a prompt with git diff and copy to clipboard:

```shell
ingest -d /path/to/project
```

Generate a prompt for multiple files/directories:

```shell
ingest /path/to/project /path/to/other/project
```

Generate a prompt and save to a file:

```shell
ingest -o output.md /path/to/project
```

## LLM Integration

Ingest can pass the generated prompt to LLMs that have an OpenAI compatible API such as [Ollama](https://ollama.com) for processing.

```shell
ingest --llm /path/to/project
```

By default this will use any prompt suffix from your configuration file:

```shell
./ingest utils.go --llm
⠋ Traversing directory and building tree...  [0s]
This is Go code for a file named `utils.go`. It contains various utility functions for
handling terminal output, clipboard operations, and configuration directories.
...
```

You can provide a prompt suffix to append to the generated prompt:

```shell
ingest --llm -p "explain this code" /path/to/project
```

## Configuration

Ingest uses a configuration file located at `~/.config/ingest/config.json`.

You can make Ollama processing run without prompting setting `"llm_auto_run": true` in the config file.

The config file also contains:

- `llm_model`: The model to use for processing the prompt, e.g. "llama3.1:8b-q5_k_m".
- `llm_prompt_prefix`: An optional prefix to prepend to the prompt, e.g. "This is my application."
- `llm_prompt_suffix`: An optional suffix to append to the prompt, e.g. "explain this code"

Ingest uses the following directories for user-specific configuration:

- `~/.config/ingest/patterns/exclude`: Add .glob files here to exclude additional patterns.
- `~/.config/ingest/patterns/templates`: Add custom .tmpl files here for different output formats.

These directories will be created automatically on first run, along with README files explaining their purpose.

### Flags

- `-i, --include`: Patterns to include (can be used multiple times)
- `-e, --exclude`: Patterns to exclude (can be used multiple times)
- `--include-priority`: Include files in case of conflict between include and exclude patterns
- `--exclude-from-tree`: Exclude files/folders from the source tree based on exclude patterns
- `--tokens`: Display the token count of the generated prompt
- `-c, --encoding`: Optional tokeniser to use for token count
- `-o, --output`: Optional output file path
- `--ollama`: Send the generated prompt to Ollama for processing
- `-d, --diff`: Include git diff
- `--git-diff-branch`: Generate git diff between two branches
- `--git-log-branch`: Retrieve git log between two branches
- `-l, --line-number`: Add line numbers to the source code
- `--no-codeblock`: Disable wrapping code inside markdown code blocks
- `--relative-paths`: Use relative paths instead of absolute paths
- `-n, --no-clipboard`: Disable copying to clipboard
- `-t, --template`: Path to a custom Handlebars template
- `--json`: Print output as JSON
- `--pattern-exclude`: Path to a specific .glob file for exclude patterns
- `--print-default-excludes`: Print the default exclude patterns
- `--print-default-template`: Print the default template
- `--report`: Print the largest parsed files
- `--verbose`: Print verbose output
- `-V, --version`: Print the version number (WIP - still trying to get this to work nicely)

### Excludes

You can get a list of the default excludes by parsing `--print-default-excludes` to ingest.
These are defined in [defaultExcludes.go](https://github.com/sammcj/ingest/blob/main/filesystem/defaultExcludes.go).

To override the default excludes, create a `default.glob` file in `~/.config/ingest/patterns/exclude` with the patterns you want to exclude.

### Templates

Templates are written in standard [go templating syntax](https://pkg.go.dev/text/template).

You can get a list of the default templates by parsing `--print-default-template` to ingest.
These are defined in [template.go](https://github.com/sammcj/ingest/blob/main/template/template.go).

To override the default templates, create a `default.tmpl` file in `~/.config/ingest/patterns/templates` with the template you want to use by default.

## Wrapping Up

Ingest is a daily time-saver for me when working with LLMs.

The code is open source and available on [Github](https://github.com/sammcj/ingest/) - Contributions are welcome, Please feel free to submit a Pull Request.

As always, if you find any bugs or have ideas for improvements, don't hesitate to open an issue or submit a PR.

Happy ingesting!
