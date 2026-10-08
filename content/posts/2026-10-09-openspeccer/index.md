---
title: "OpenSpeccer - A Read-Only OpenSpec Dashboard"
date: 2026-10-08T23:00:00+10:00
tags: ["AI", "LLM", "agentic coding", "agents", "skills", "claude code", "openspec", "spec driven development"]
author: "Sam McLeod"
draft: true
description: "A small, read-only local dashboard for OpenSpec projects, shipped as an Agent Skill."
searchHidden: false
cover:
  image: "dashboard.png"
  alt: "OpenSpeccer dashboard showing spec counts, a kanban of changes and specs in flight"
  hidden: true
---

[OpenSpeccer](https://github.com/sammcj/agentic-coding/tree/main/Skills/openspeccer) is a read-only web dashboard for any repository using [OpenSpec](https://github.com/Fission-AI/OpenSpec), showing what's in flight, how far along each change is, and what every spec currently says. It ships as an Agent Skill, runs on Python's standard library and needs no install or build step.

{{< wide-image src="dashboard.png" alt="OpenSpeccer dashboard" >}}

## Why

With OpenSpec the state of a project lives in a pile of markdown files spread across `openspec/changes/`. When I've had several agents working in separate git worktrees, each holding its own copy of a change, working out what's actually happening means opening a lot of files in a lot of directories.

I wanted one page I could glance at, that updates as the agents work, and that never writes anything.

## Getting started

1. Copy [`Skills/openspeccer`](https://github.com/sammcj/agentic-coding/tree/main/Skills/openspeccer) into your agent's skills directory (`~/.claude/skills/` for Claude Code).
2. Ask your agent to open the OpenSpec dashboard, or run it yourself:

```shell
~/.claude/skills/openspeccer/scripts/serve.py ~/git/my-project
```

With no path it searches upward from the current directory for `openspec/`. It serves on port 4380 (or the next free port) and opens your browser. Running it again for the same repo reuses the server that's already up.

The OpenSpec CLI is optional. Without it, everything except the Schemas and Commands pages still works.

## A tour

### Dashboard

The dashboard is a kanban of active changes by stage: proposed, planned, in progress, ready to archive, and recently archived. Across the top are spec and requirement counts, task progress across active changes, average lifecycle, and how many active changes have gone untouched for 30 days.

Below the board, _Specs in flight_ lists every spec an active change touches, and which changes touch it.

When worktrees hold different copies of the same change, its card shows a "versions" badge.

### Changes

Each change opens with one tab per artifact: tasks, specs, design and proposal. Sort the tabs by modified time, schema order or name. The tasks tab shows progress per section with the checklist rendered as markdown.

{{< wide-image src="changes.png" alt="A change's tasks tab with per-section progress" >}}

The change list shows active and archived changes together, with active ones first.

### Specs

Specs show as a filterable tree, with a dot on any spec an active change is modifying. Each spec is broken into requirement cards with their scenarios, BDD keywords highlighted and an outline down the side.

The _History_ tab lists every change with a delta for the spec, and _Diff_ compares the spec between any two git revisions.

{{< wide-image src="specs.png" alt="A spec broken into requirement and scenario cards" >}}

### Timeline

The timeline has a burndown up top:

- Open changes now, plus changes opened and archived per week over the last four weeks
- A projected date for clearing the open changes, or "Not burning down" when they're opening as fast as they're archiving
- A step chart of open changes over time, and a bar chart of changes opened (up) and archived (down) per week

Below that, each change's lifecycle is a bar from creation to archive, coloured by stage, and can be grouped by spec.

{{< wide-image src="timeline.png" alt="Timeline with burndown stats, open changes chart and change lifecycles" >}}

### Schemas

Schemas are drawn as a workflow graph from their `requires` declarations, so you can see which artifacts depend on which before implementation starts. Edges a longer path already implies are left out to keep the graph readable.

{{< wide-image src="schema.png" alt="The spec-driven schema as a workflow graph" >}}

### Agents

The Agents page lists each coding agent in the project and which OpenSpec skills or commands it has installed.

{{< wide-image src="agents.png" alt="Agents with OpenSpec skills and commands installed" >}}

### Commands

A reference for every command and option the installed OpenSpec CLI has, read from its own `--help` output so it matches your version. Click a command to copy it. There are links to the official docs at the top.

{{< wide-image src="commands.png" alt="Commands reference built from the installed OpenSpec CLI" >}}

### Export

Specs, changes and the timeline each have an Export menu: save as Markdown, copy as Markdown, or save the page as a standalone HTML file. A change exports every artifact verbatim, a quick way to hand a change to someone who doesn't have the repo.

## Without a browser

Agents can use it too. When I ask "what's in flight?", the agent runs it with `--summary` and answers from the output, without starting a server:

```text
cotyper ($HOME/git/sammcj/cotyper)
Specs 24 (187 requirements) | Active 2 | Archived 6 | Active tasks 87/90 (96%)

In progress:
  - mvp-a [spec-driven] 71/74 tasks, updated 2026-10-08 @ worktree-agent-a74082cbc1d24bbbb

Ready to archive:
  - suggestion-quality [spec-driven] 16/16 tasks, updated 2026-10-08

Recently archived:
  - 2026-10-08-spike-placement
  - 2026-10-08-mvp-c
  - 2026-10-08-mvp-b
```

`--change <slug>` prints one change's artifacts and tasks as JSON, and `--json` prints the lot.

## Design notes

- **Read-only.** Creating, editing and archiving stay with OpenSpec and your agent.
- **Live.** It polls the `openspec/` directories and pushes updates to the page over server-sent events, so there's nothing to refresh while agents work.
- **Worktree aware.** Active changes from every git worktree are aggregated by default, with jj workspaces available behind `--jj`.
- **No install or build.** The server is Python standard library. The frontend is Preact, htm and marked, vendored, with no build step.
- **Reads from disk.** Specs and changes are parsed straight from disk. The CLI is only asked about the things it owns: which schemas exist and what its commands are.

The skill is in my [agentic-coding](https://github.com/sammcj/agentic-coding) repo along with my other skills.
