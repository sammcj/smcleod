---
title: "The Role Bridging Problem"
date: 2025-11-20T01:10:00+10:00
tags: ["ai", "llm", "tech", "agentic coding", "mcp", "learning", "software engineering"]
author: "Sam McLeod"
showToc: true
TocOpen: false
draft: false
hidemeta: false
comments: false
summary: "An observation on functional correctness without domain quality."
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
# cover:
#   image: "tool-context-usage.png"
#   alt: "MCP Server Tool Context Usage"
#   # caption: "Optional caption text"
#   relative: true  # Set to true for page bundle images
---

An observation on functional correctness without domain quality.

AI tools are enabling people to work beyond their existing capabilities to learn and contribute in places they wouldn't otherwise. The risk emerges when operating outside one's area of expertise - when the ability to generate output outpaces the ability or incentive to evaluate its quality. The technology makes this possible, left unchecked, the results demonstrate why domain expertise still matters.

## Expertise Gap

Without domain expertise to architect, guide and critique AI-generated work, two paths emerge:

1. Moving forward while being unaware of the quality and alignment gap that stems from a lack of domain expertise.
2. Giving up, thinking that the AI isn't capable of delivering quality results.

Let's talk about the former for a moment.

Code gets written, interfaces get built, documents get produced, and they all _look_ correct enough to ship. The output appears competent, so it moves forward without the critical evaluation that domain expertise provides.

This is particularly insidious because the work is often functionally correct. Tests pass, the UI renders, the API responds. What's missing is the engineering mindset - the architectural considerations, the edge case handling, the maintainability concerns that come from actually understanding the domain you're working in.

- When a data analyst uses AI to submit a pull request to codebases they otherwise wouldn't touch - they're producing code, but not applying software engineering principles.
- When a front-end developer generates backend code, it might work today but could lack the patterns that make it work reliably at scale.
- When designers use tools like Figma AI or V0 to generate frontend code, the interface looks polished but the code underneath may be unmaintainable or introduce tight coupling.

The work ships because it superficially meets requirements. The problems emerge later - in production incidents, in refactoring costs, in the accumulated friction of a codebase that wasn't built with engineering craft.

## Technical Debt at Scale

**Visual prototyping tools**: Figma AI and V0 sell themselves as capable of generating production code, but the output is often unmaintainable - instant technical debt that looks good in demos.

**Code from non-engineers**: People with expertise in areas other than software development using AI to write code that functions but violates fundamental engineering principles or introduces poor architectural patterns. The pull requests either get rejected by frustrated development teams or make it through and the codebase degrades.

**Domain switching by engineers**: A front-end specialist using AI to write API code may produce something that works, but lacks the architectural patterns, error handling, and security considerations that backend expertise provides.

**Non-technical documents**: Engineers underestimate the expertise required for effective proposals and communications, leading to declining quality as they accept generic AI outputs without applying the critical thinking and domain knowledge that BAs and product owners would bring.

## What's Missing

The pattern is consistent: functional correctness without domain quality. The code runs, the document reads coherently, the interface renders - but none of it reflects the practices and considerations that come from actual expertise in that area.

AI tools excel at acceleration, automation and helping us learn. The issue isn't the tools themselves, but how we apply them. Engineering problems require an engineering mindset - the critical thinking to evaluate outputs, iterate on solutions, and recognise when generated code lacks the architectural patterns or error handling that deliver high quality outcomes.

The solution isn't prescriptive rules about what you can and can't do with AI, or constraints that lock you into your initial capabilities. Use AI to accelerate your work and learn adjacent domains, but apply critical thinking to the outputs. When you're working outside your expertise, ask questions. Involve people who live in that domain and learn from them. Push back when managers expect AI tooling to mean you can single-handedly deliver work that spans multiple specialisms.

Good engineering still requires good engineers - AI doesn't change that, but it can create the illusion of competence without the substance.

## Bridging the Gap

If you're using AI to work in adjacent domains, there are practical steps to improve the quality of the artefacts you produce:

**Extend AI capability beyond base knowledge**: Use Model Context Protocol (MCP) tools to connect AI to documentation, code repositories, and domain-specific knowledge. Rather than simply relying on the model's internal training data that will be outdated and is certainly generic.

**Constrain and guide with agent rules**: Agent rules (really more suggestions than rules) help to reinforce boundaries, patterns, and standards. Whenever repeatedly AI fails to follow instructions or operate outside your intended scope - that is an opportunity to consider adding or refining your agent rules.

**Document and have AI operate from a plan**: Establish quality gates, good workflows help to keep agents on task and create checkpoints where domain experts review outputs before they move forward.

**Recognise your evaluation limits**: You're probably outside your ability to properly judge AI outputs when:

- You're accepting code because it runs, not because you understand (or could understand) its architectural implications
- You can't articulate why one approach might be better than another in that domain
- You're not certain which edge cases matter or how they should be handled
- You find yourself defending AI outputs without being able to explain the trade-offs

If you recognise these patterns, consider involving a domain expert. It's not about gate-keeping, it's about leveraging people with the right skills, experience and judgement to help drive high quality outcomes.
