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
cover:
  image: "facade-of-competence-jpeg-2260.jpg"
  alt: "The Facade of Competence"
  relative: true  # Set to true for page bundle images
---

An observation on functional correctness without domain quality.

AI tools are enabling people to work beyond their existing capabilities to learn and contribute in places they wouldn't otherwise. The risk emerges when operating outside one's area of expertise - when the ability to generate output outpaces the ability or incentive to evaluate its quality. The technology makes this possible, left unchecked, the results demonstrate why domain expertise still matters.

## The Expertise Gap

Without domain expertise to architect, guide and critique AI-generated work, two paths emerge:

1. Moving forward while being unaware of the quality and alignment gap that stems from a lack of domain expertise.
2. Giving up, thinking that the AI isn't capable of delivering quality results.

Let's focus on the first path - the more insidious one.

Code gets written, interfaces get built, documents get produced, and they all _look_ correct enough to ship. The output appears competent, so it moves forward without the critical evaluation that domain expertise provides.

This is particularly problematic because the work is often functionally correct. Tests pass, the UI renders, the API responds. What's missing is the domain mindset - the architectural considerations, the edge case handling, the maintainability concerns that come from actually understanding the domain you're working in.

It's the ultracrepidarian's dilemma: AI provides the competence to produce, but not the expertise to evaluate.

Consider these scenarios:

- A data analyst uses AI to submit a pull request to codebases they otherwise wouldn't touch - they're producing code, but not applying software engineering principles.
- A front-end developer generates backend code that works today but lacks the patterns that make it work reliably at scale.
- Designers use tools like Figma AI or V0 to generate frontend code where the interface looks polished but the code underneath is unmaintainable or introduces tight coupling.
- Engineers draft proposals that read coherently but lack the strategic thinking and stakeholder awareness that experienced BAs and product owners would bring.

The work ships because it superficially meets requirements. The problems emerge later.

## Technical Debt at Scale

The real cost isn't visible immediately. It accumulates over time as these outputs compound:

**Erosion of quality standards**: As AI-generated output that "looks good enough" ships more frequently, teams may unconsciously lower their quality bar. The distinction between functional correctness and engineering quality blurs.

**Maintenance burden**: Code that works but wasn't built with an engineering mindset becomes increasingly expensive to modify. Each change requires understanding and working around patterns that don't align with the domain's best practices.

**Knowledge gaps**: When people contribute code to systems they aren't capable of understanding, the codebase becomes fragmented. Different sections follow different patterns, making it harder for the team to maintain a coherent mental model.

**Review fatigue**: Development teams spend increasing time either rejecting pull requests from well-intentioned contributors or cleaning up merged code that technically functions but violates fundamental principles.

**False velocity**: Teams may appear to move faster because more work ships, but the accumulated friction slows future development. Technical debt grows faster than it's addressed.

The pattern is consistent across domains: functional correctness without domain quality. The code runs, the document reads coherently, the interface renders - but none of it reflects the practices and considerations that come from actual expertise in that area.

## Moving Forward

AI tools excel at acceleration, automation and helping us learn. The issue isn't the tools themselves, but how we apply them. Engineering problems require an engineering mindset - the critical thinking to evaluate outputs, iterate on solutions, and recognise when generated code lacks the architectural patterns or error handling that deliver high quality outcomes.

The solution isn't prescriptive rules about what you can and can't do with AI, or constraints that lock you into your initial capabilities. Use AI to accelerate your work and learn adjacent domains, but apply critical thinking to the outputs. When you're working outside your expertise, ask questions. Involve people who live in that domain and learn from them. Push back when managers expect AI tooling to mean you can single-handedly deliver work that spans multiple specialisms.

Good engineering still requires good engineers - AI doesn't change that, but it can create the illusion of competence without the substance.

## Bridging the Gap

If you're using AI to work in adjacent domains, there are practical steps to improve the quality of the artefacts you produce:

**Extend AI capability beyond base knowledge**: Use Model Context Protocol (MCP) tools to connect AI to documentation, code repositories, and domain-specific knowledge. Rather than simply relying on the model's internal training data that will be outdated and is certainly generic.

**Constrain and guide with agent rules**: Agent rules (really more suggestions than rules) help to reinforce boundaries, patterns, and standards. Whenever AI repeatedly fails to follow instructions or operate outside your intended scope - that is an opportunity to consider adding or refining your agent rules.

**Document and have AI operate from a plan**: Establish quality gates, good workflows help to keep agents on task and create checkpoints where domain experts review outputs before they move forward.

**Recognise your evaluation limits**: You're probably outside your ability to properly judge AI outputs when:

- You're accepting code because it runs, not because you understand (or could understand) its architectural implications
- You can't articulate why one approach might be better than another in that domain
- You're not certain which edge cases matter or how they should be handled
- You find yourself defending AI outputs without being able to explain the trade-offs

If you recognise these patterns, consider involving a domain expert. It's not about gate-keeping, it's about leveraging people with the right skills, experience and judgement to help drive high quality outcomes.
