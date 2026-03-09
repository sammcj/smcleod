---
title: 'The advice I find myself repeating every time someone asks how to get started with Claude Code'
date: 2026-03-05T01:00:00+10:00
tags: ['ai', 'claude', 'agentic-coding', 'claude-code', 'tips', 'productivity']
author: 'Sam McLeod'
showToc: true
TocOpen: true
draft: false
hidemeta: false
comments: false
description: 'I spend a lot of my time helping people who are getting started with Claude Code. These are the key things I find myself repeating.'
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
mermaid: false
---

- **Configuration**
  - [Layered rules](#add-tight-layered-rules) - concise, scoped CLAUDE.md files that shape agent behaviour
  - [Sandboxing](#enable-sandboxing) - constrain file access and network connections
  - [Permissions](#set-up-allow-ask-and-deny-permissions) - pre-approve safe operations, hard-block dangerous ones
  - [Hooks](#use-hooks-to-help-with-safety-and-automation) - run shell commands before/after tool calls as a safety net
- **Extend knowledge and capabilities**
  - [Skills](#2-lean-into-skills) - on-demand markdown knowledge the agent self-selects when relevant
  - [Language servers](#5-enable-lsp-for-code-intelligence) - give the agent go-to-definition, find-references, and type checking
  - [MCP tools](#6-take-a-minimalist-approach-to-mcp-tools) - external tool servers, used sparingly
- **Workflow**
  - [Plan before acting](#3-use-planning-mode) - read-only exploration before making changes
  - [Start fresh sessions](#4-embrace-starting-fresh-sessions) - keep context windows lean
  - [Custom commands](#create-commands-for-frequent-prompts) - reusable prompts for common tasks

![](/2025/04/my-plan-document-act-review-flow-for-agentic-software-development/setup-plan-act-iterate.svg)

---

## 1. Setup

### Add tight, layered rules

Claude Code loads `CLAUDE.md` files into context on every single message. Every line you add is tokens the model has to process and remember. Treat it like a config file, not a wiki.

Use two layers:

- **Global** (`~/.claude/CLAUDE.md`) - things that apply to every project: language preferences, security rules, things to never do
- **Project** (`<repo>/CLAUDE.md` or `<repo>/.claude/CLAUDE.md`) - repo-specific context: build commands, architecture decisions, testing patterns

```text
~/.claude/CLAUDE.md           # always loaded, every project
<project>/CLAUDE.md           # loaded for that project only
<project>/.claude/CLAUDE.md   # alternative location (same effect)
```

Think about the signal-to-noise ratio. If a rule isn't relevant to the current task, it's just noise misleading the prediction engine. Be clear, concise and specific. Don't blindly import someone else's entire rule set (including mine).

Project-level CLAUDE.md files should be checked into the repo so your whole team benefits.

Remember: Rules are suggestions, not hard controls.

- [Claude Memory / Rules](https://code.claude.com/docs/en/memory)
- [Claude.md vs Rules vs Skills](https://code.claude.com/docs/en/features-overview#claude-md-vs-rules-vs-skills)

### Enable sandboxing

[Sandboxing](https://code.claude.com/docs/en/sandboxing) constrains what Claude Code can read, write and connect to. It's the single fastest way to limit the blast radius of a runaway agent.

In `~/.claude/settings.json`:

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "network": {
      "allowedDomains": [
        "*.github.com",
        "*.githubusercontent.com",
        "*.npmjs.com",
        "*.pypi.org",
        "*.crates.io",
        "*.golang.org",
        "*.docker.io",
        "*.smcleod.net"
      ]
    },
    "excludedCommands": ["docker", "ssh", "uv run"]
  }
}
```

The network allowlist stops the agent from making unexpected outbound connections. `autoAllowBashIfSandboxed` means you don't get prompted for every shell command when the sandbox is already constraining what it can do. `excludedCommands` lets you exempt specific commands that need network access the sandbox would otherwise block.

Note: The sandbox is not a silver bullet. Claude can actually choose not to use the Sandbox if it encounters problems with it - and somewhat [idiotically there's no way to disable this - _yet_](https://github.com/anthropics/claude-code/issues/10089).

### Set up allow, ask, and deny permissions

[Permissions](https://code.claude.com/docs/en/permissions) let you pre-approve safe operations (so you're not interrupted constantly) and hard-block dangerous ones (so a confused agent can't do real damage). The syntax is `Tool(pattern *)`.

```json
{
  "permissions": {
    "allow": [
      "Bash(git diff *)",
      "Bash(git status *)",
      "Bash(go *)",
      "Bash(cargo *)",
      "Edit(./**/*.go)",
      "Edit(./**/*.ts*)",
      "Edit(./**/*.py)",
      "WebFetch",
      "WebSearch"
    ],
    "deny": [
      "Bash(sudo *)",
      "Bash(git push *)",
      "Bash(rm -rf ~*)",
      "Read(~/.ssh/**)",
      "Read(**/secrets/**)"
    ],
    "ask": [
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(rm -rf *)",
      "Bash(ssh *)",
      "Read(**/.env)"
    ]
  }
}
```

The deny list is your hard safety net. `git push` and `sudo` are the obvious ones. The ask list catches things that are usually fine but you want to eyeball first, like commits and destructive deletes. Everything in allow runs without prompting.

### Use hooks to help with safety and automation

Hooks can run shell commands before or after tool calls. `PreToolUse` hooks can inspect and block commands before execution which can be used as a line of defence against unexpected behavior.

- [claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net) is one I often recommend as a good starting point that aims to catch common dangerous patterns.

---

## 2. Lean into skills

[Skills](https://agentskills.io) are an effective way of extending your agent's knowledge. Think of them like a library where the agent can see all the book spines and pull out the relevant one whenever it encounters a situation where that knowledge would be useful. They're simple markdown files that Claude loads into context on demand, rather than permanently like rules.

Skills live in `~/.claude/skills/` (global) and `.claude/skills/` (project-level). Each skill has a `SKILL.md` with a name and concise description in its front matter. The agent sees all skill names and descriptions automatically and self-selects the relevant ones.

```text
~/.claude/skills/
├── code-review/
├── go-testing/
├── shell-scripting/
├── systematic-debugging/
├── extract-wisdom/
└── ...
```

As well as the official skills documentation, you can see my [skill creator skill](https://github.com/sammcj/agentic-coding/blob/main/Skills/skill-creator/SKILL.md) (meta, I know).

Note: Never blindly install skills you find online, always review the content and any attached scripts to make sure they're not malicious and are aligned with your goals.

- Anthropic publishes some [official skills](https://github.com/anthropics/skills) for common tasks like creating PPTX and DOCX files.
- I publish most of my skills publicly in my [agentic-coding](https://github.com/sammcj/agentic-coding/tree/main/Skills) repo.

---

## 3. Use planning mode

Planning mode (`shift+tab` to toggle) keeps the agent in read-only exploration mode. It can use sub-agents, read files, search code, use tools to research - but it can't make changes until you approve its plan.

This is valuable for anything beyond a simple, targeted fix. The plan itself is an artefact you can inspect and refine with Claude, when you're ready Claude will offer to start a fresh session to act upon the plan.

**[TLDR](/posts/2025-04-28-agentic-coding-dev-flow/): plan first, act second, iterate.**

---

## 4. Embrace starting fresh sessions

LLMs are stateless. Every message you send includes the full conversation history. As a session gets longer, the model has more to process; it slows down and output quality degrades.

Embrace starting fresh sessions, operating from a plan allows you to do this without losing where you're up to.

### Create commands for frequent prompts

In addition to operating from a plan, you can also create commands for frequent prompts in `~/.claude/commands/` (global) or `.claude/commands/` (project). They become `/command-name` in the CLI.

Here's my most-used one, `/self-review` that I run after Claude completes multiple tasks:

```markdown
---
description: Conduct a critical self-review of your changes & fix any errors
---

Please conduct a critical self-review of your changes, check for
any errors or changes you missed, correct any errors you may find.
```

---

## 5. Enable LSP for code intelligence

Claude Code has a built-in LSP tool that gives the agent access to go-to-definition, find-references, hover types, and diagnostics - the same code intelligence IDEs use. With LSP enabled, the agent can navigate code structurally rather than relying on text search - jumping to definitions, finding all call sites before refactoring, and catching type errors as it works.

It's enabled by installing [code intelligence plugins](https://code.claude.com/docs/en/discover-plugins#code-intelligence) from the official marketplace:

```bash
# Browse available code intelligence plugins (try searching for 'lsp')
/plugin

# Or install directly, e.g.
/plugin install typescript-lsp@claude-plugins-official
```

Some LSPs may also need the language servers installed for the languages you work with:

```bash
# Python
pip install python-lsp-server   # or: uvx install python-lsp-server

# Go (included with the Go toolchain)
go install golang.org/x/tools/gopls@latest

# Rust
rustup component add rust-analyzer

# TypeScript / JavaScript
pnpm install -g typescript typescript-language-server
```

---

## 6. Take a minimalist approach to MCP tools

Every MCP server you enable adds tool descriptions to the context. If you have 10 servers each exposing 5-20 tools, that's a lot of tokens spent in every interaction just telling the model what's available.

- If you have easy to use CLI tools (e.g. `gh` for Github) - let the agent use those instead of adding permanent MCP servers for them.
- Don't load every MCP server for every project. Use project-level `.claude/settings.json` to scope servers to where they're actually needed.
- For 99% of tasks [I only have one MCP server enabled](https://github.com/sammcj/mcp-devtools).

---

Most of the rules, skills, hooks and commands I use are in my [agentic-coding](https://github.com/sammcj/agentic-coding) repo. Take what's useful, ignore the rest.
