---
title: 'Writing and Reviewing Agent Skills - Common Pitfalls'
date: 2026-07-04T01:00:00+10:00
tags: ['ai', 'llm', 'agentic coding', 'agents', 'skills', 'claude', 'claude code']
author: 'Sam McLeod'
showToc: true
TocOpen: false
draft: false
hidemeta: false
comments: false
description: 'The top pitfalls I keep seeing when reviewing Agent Skills, and what to do instead'
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

I write and review a _lot_ of [Agent](https://code.claude.com/docs/en/skills) [Skills](https://agentskills.io), and find myself frequently pushing back in reviews, as many authors assume they're writing "_just another markdown prompt_" without considering that they're actually working with one component of an agentic system.

The **TLDR** of my feedback is usually along the lines of:
> 1. The description's _only_ job is to tell the agent when the skill should be triggered.
> 2. Keep the description as terse as possible while still triggering.
> 3. The SKILL.md should be lean with detail pushed to reference files.
> 4. Put repeatable work in scripts rather than relying on model inference.

---

## Skill Creator Primer

I recommend teams use or create their own version of my [skill-creator-primer](https://github.com/sammcj/agentic-coding/blob/main/Skills/skill-creator-primer/SKILL.md) skill.

The primer works alongside the official Anthropic skill-creator skill and aims to catch common pitfalls and align with best practices.

> [!TIP] Proactively use the primer
> While the primer should activate passively when working with skills, to get the most out of it ask your agent to use it to review your work:
>
> _"First please activate your skill creator primer skill._
> _Then, I want you to look at my coworkers PR: <URL to PR or branch>_
> _and conduct a critical review."_

## The top five pitfalls

### 1. Descriptions written as summaries

The description's only job is telling the agent when to load the skill. Summarising the contents invites the agent to act on the summary and skip the skill.

- Roughly 30-55 words, imperative, naming the specific triggers.
- The description should only contain information that is specific to knowing when to trigger the skill.
- Some agents under-trigger, so be slightly assertive while keeping it tight.
- Unsure it fires? Write a handful of trigger evals: realistic prompts labelled should/shouldn't trigger.

> [!EXAMPLE] Example:
> description: 'You MUST use this skill whenever the user mentions dashboards, monitoring or metrics.'

> [!TIP] If your skill doesn't need to be triggered by an agent
> Set `disable-model-invocation: true` in the frontmatter so its description isn't loaded into every session

### 2. No progressive disclosure

The main `SKILL.md` should inline only what every use of the skill needs, regardless of the situation.
Practising progressive disclosure keeps skills lean, reusable and composable.

Other bundled information such as handling for specific scenarios goes in `references/<file>.md` behind a pointer that says when to read it, e.g:
> [!EXAMPLE] Example:
> "Step 3: If working on frontend codebase you must first read 'references/frontend.md'"

### 3. Making the model do a script's job

If a step is often repeated, deterministic or requires a high degree of accuracy, bundle a small script.

- A script is faster, should provide the same result every run and is testable.
- Favour using Python and its stdlib where possible.
- If you _need_ to add dependencies use [PEP-723](https://peps.python.org/pep-0723/) inline metadata.
- Instruct the agent to run with `uv run scripts/my-script.py <args>`.

### 4. Too much content, too many skills

Skills are for agents, not humans. Terse wins. The deletion test: cut a line and ask whether the agent's behaviour would change. If not, it stays cut.

The same can be true for having too many skills (without good reason to do so) - especially if the descriptions aren't tight, focused or well differentiated. Favour one skill with progressive disclosure (references for each scenario) over lots of smaller but related skills.

### 5. Stepped workflows with no structure

For workflows that must be followed within a skill:

- Instruct the agent to track each step.
- Number the steps.
- Trigger a review after all steps are complete.

> [!EXAMPLE] Example:
> Create and track a task / TODO for each step:
> 1. Do x
> 2. Do y
> 3. Do z
>
> Once all steps are completed conduct a critical review of the work and make any necessary corrections.

Agents drift and finish early on long procedures; a visible checklist stops that. The same is true if your skill instructs the agent to task sub-agents with their own workflows.

## General tips

- Don't wrap text in markdown - manual line breaks mean more lines for the agent to read in.
- For reference files over ~100 lines, add a simple TOC near the top (but not in the main `SKILL.md`).
- If your skill is very complex, add an `AGENTS.md` / `CLAUDE.md` in its root to help you and others maintain it.
- A single entry point for interacting with your software project (`make lint`, `make test`, `make build`, `make run`, etc.) makes it easy for agents and skills to do the right thing everywhere.

## A note on Agent Skills vs Custom Agents

- Custom Agents:
  - Can be thought of as a "persona", think as if you were asked to put yourself in someone else's shoes.
  - May include workflows / ways of working but keep it light and instead have them use skills.
  - Good for adversarial tasks as they get their own context and world view.
  - Operate within their own context (usually).
- For knowledge, detailed workflows, helper tools etc., favour Skills over Custom Agents.
- Skills are powerful as they're composable and often portable.
- If you need a custom agent and want it to be read-only, set `permissionsMode: plan` in its frontmatter.
- There's no need to create a custom agent for normal development tasks - that's what the main / general agent is for.

## Review signals

Quick tells that a skill wasn't reviewed carefully:

- Descriptions that have information not specific to knowing when to trigger the skill.
- Descriptions that are more than 1-3 tight sentences - if it looks like a paragraph, it probably hasn't been thought through.
- Overly verbose, long form prose in the body of the skill or resources.
- Getting agents to do the work of scripts, have them write and drive the scripts instead.
- _"When to use"_ in the body - if the agent is reading that, it's too late. It's also a sign the author may not have understood what they were creating.

## Security tips

Treat third party skills as you would any other software or library obtained from the internet - don't blindly install them without first reviewing their content.

- Skills can include both prompts (`SKILL.md`, references) and scripts, review the markdown for malicious or risky instructions that could mislead the agent.
- If the skill contains scripts, consider running dependency and SAST scanning tools (e.g. SonarQube) across the content.
- When writing scripts within skills, aim to use the standard library where possible.
- Apply the principle of least privilege in the frontmatter configuration - does the skill really need web search or write tools?
- Where possible, run your agentic coding tool in a sandbox.
