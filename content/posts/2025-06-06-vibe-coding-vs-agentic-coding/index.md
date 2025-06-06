---
title: "Vibe Coding vs Agentic Coding"
date: 2025-06-06T01:10:00+10:00
tags: ["ai", "llm", "tech", "ollama", "coding", "cline", "agentic", "tutorials", "llama", "agentic coding", "vibe coding"]
author: "Sam McLeod"
showToc: true
TocOpen: true
draft: false
hidemeta: false
comments: false
description: "From Creative Exploration to Production Quality"
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
---

Picture this: A business leader overhears their engineering team discussing "vibe coding" and immediately imagines developers throwing prompts at ChatGPT until something works, shipping whatever emerges to production. The term alone—"vibe coding"—conjures images of seat-of-the-pants development that would make any CTO break out in a cold sweat.

This misunderstanding is creating a real problem. Whilst vibe coding represents genuine creative exploration that has its place, the unfortunate terminology is causing some business leaders to conflate all AI-assisted / accelerated development with haphazard experimentation. I fear that engineers using sophisticated AI coding agents be it with advanced agentic coding tools like Cline to deliver production-quality solutions are finding their approaches questioned or dismissed entirely.

The irony is that these same business leaders are missing out on the transformative potential of agentic coding—a disciplined approach that treats AI as a skilled development partner rather than a random code generator. The difference isn't just semantic; it's the distinction between sustainable engineering practice and creative tinkering.

To understand why this distinction matters, I like clarify what we're actually talking about into these two distinct approaches:

**Vibe Coding** represents an experimental and creative process where users prompt their way to creating their idea. It's immediate, intuitive, and often produces remarkable results through iterative experimentation.

**Agentic Coding** by contrast, focuses on leveraging AI coding agents as engineering *peers* that you can co-engineer solutions with. It's structured, deliberate, and designed for sustainable outcomes.

The confusion between these approaches is costing businesses the opportunity to leverage AI's potential in a safe, secure and maintainable way.

---

## Vibe Coding: Fast, Fun and Creative

And we should never want to take away from the people that are doing it, nor should we encourage gate keeping of AI coding tools, or AI in general.

It's amazing what people can create with Vibe Coding - folks that may have never written more than a few lines of code can explore their creativity and have a great time building something that they would otherwise may have not been able to create.

But it is important that we realise (at least with our current capabilities) that Vibe Coded applications may not deliver production-ready, maintainable, business aligned solutions, architected with an engineering mindset.

Of course - not all solutions _need_ to be well engineered or production ready, but significant portion of applications found running in businesses today would have an impact if they were to fail or become unmaintainable.

## Agentic Coding: An AI Engineering Peer, Not a Magic Wand

Agentic coding - while still leveraging AI coding tools takes a more engineered and extended approach. Rather than treating AI as a black box that spits out code, it positions AI agents as sophisticated development partners equipped with the right tools, context, data and constraints to deliver production-grade solutions.

This isn't about asking an AI to write your entire application—it's about creating a more structured, measurable development process where AI agents work within defined parameters, armed with the right tools and knowledge to make informed decisions on tasks towards completing a goal.

- Humans operating with an engineering mindset.
- Significant value is placed on the time invested in design before implementation.
- Agents enabled with tools to extend their capabilities and knowledge.
- Agents aligned to business and technical requirements.
- Leverage deterministic tools for deterministic outcomes.
- Apply the same quality and security measures as you would for a human.

It's a shift from treating AI as full auto-pilot to treating it as a peer developer who operates best with proper tooling and context.

---

## Agentic Coding: Workflow

I like to follow a "[Setup → Plan → Act → Review and Iterate](https://smcleod.net/2025/04/my-plan-document-act-review-flow-for-agentic-software-development/)" workflow for agentic coding, which can loosely be broken down as:

- **Setup**: Configure your coding agent with the right MCP tools, access to documentation, coding standards, and business context
- **Plan**: Have the agent analyse requirements, propose architecture, and create a structured approach before writing code
- **Act**: Let the agent implement solutions while adhering to established patterns and constraints
- **Review and Iterate**: Human oversight validates outputs, provides feedback, and guides refinements

## Agentic Coding: Tooling

A key component of agentic coding is the integration of MCP servers that give AI agents access to tools (external integrations), new capabilities (skills) and data sources (knowledge).

For example:

- Query package repositories (internal or private) for version availability
- Access package, library and framework documentation or even example implementation patterns
- Augment the coding style with language best practices, guidelines or internal coding standards
- Integrate with existing development workflows and CI/CD
- Accelerating security remediation by enabling the agent to run your security scanning tools and action any findings autonomously
- Understand business or technical context and requirements resulting in aligned solutions

This tooling transforms AI from a code generator into a contextually aware development partner.

---

## The Critical Contrasts

| Aspect                      | Vibe Coding                                         | Agentic Coding                                                   |
|:----------------------------|:----------------------------------------------------|:-----------------------------------------------------------------|
| **Primary Approach**        | Creative experimentation through prompting          | Structured collaboration with AI as development peer             |
| **Skills Required**         | Minimal technical background needed                 | Strong engineering fundamentals and system design skills         |
| **Planning Phase**          | Iterative discovery purely through trial and error  | Upfront analysis, architecture design, and requirement mapping   |
| **Tool Integration**        | Usually minimal                                     | MCP servers, documentation access, and development toolchains    |
| **Quality Assurance**       | Manual testing of immediate outputs                 | Automated testing, code review, and adherence to standards       |
| **Business Alignment**      | Solutions may drift from actual requirements        | Explicitly designed for business needs and technical constraints |
| **Code Maintainability**    | Often produces write-once, difficult-to-modify code | Emphasises readable, documented, and extensible solutions        |
| **Technical Debt**          | Accumulates rapidly without structured oversight    | Actively managed through proper engineering practices            |
| **Scalability**             | Struggles with complex, multi-component systems     | Designed for enterprise-scale, distributed architectures         |
| **Security Considerations** | Ad-hoc, often overlooked in creative process        | Integrated security scanning and compliance from the start       |
| **Time to Demo**            | Very fast for proof-of-concepts                     | Slightly higher initial investment, faster long-term iterations  |
| **Production Readiness**    | Requires significant refactoring for production     | Built with production deployment and operations in mind          |

**Key Insight**: The fundamental difference isn't about speed or AI capability—it's about treating development as either creative exploration or an engineering practice.

## The Enterprise Imperative

As organisations increasingly rely on AI-assisted development, the choice between vibe and agentic coding becomes a strategic decision. Vibe coding might get you to a demo faster, but agentic coding gets you to sustainable, scalable solutions that can form the backbone of real businesses.

The key is understanding that effective agentic coding isn't about replacing human developers—it's about augmenting human capabilities with AI agents that have the right tools, context, and constraints to deliver professional-grade results.

---

## For Those Making the Transition

If you're currently vibe coding and want to transition to agentic coding for production work, here's how to make that shift practically.

### Start with Constraints, Not Freedom

Instead of open-ended prompts like "build me a user authentication system," begin with structured requirements: "Create a JWT-based authentication system following OWASP guidelines, using our existing PostgreSQL schema, and adhering to our TypeScript coding standards." Configure your AI agent with these constraints upfront.

### Build Your Agent's Toolkit

Start by integrating two or three MCP servers that provide tooling that a good human engineer would use—perhaps access to your internal API documentation,your security scanning tools or access to your architectural decision records.

### Implement Human Checkpoints

Establish specific review gates in your workflow. After the planning phase, review the proposed architecture before implementation begins. After initial implementation, conduct a technical review focusing on maintainability and business alignment. These aren't bureaucratic hurdles—they're quality gates that ensure your AI partner stays on track.

### Practice Iterative Refinement

When your agent produces code that works but isn't quite right, resist the urge to start over with a new prompt. Instead, provide specific feedback: "This function handles the happy path well, but needs error handling for network timeouts and invalid API responses." Teaching your AI to improve existing code builds better long-term solutions than constantly generating fresh approaches.

### Document and Template Your Patterns

As you develop successful agentic workflows and coding agent templates, document the prompts, constraints, and review criteria that work best for your context. This turns your individual learning into repeatable organisational capability, allowing other team members to leverage the same structured approach rather than starting from scratch with their own vibe-based experiments.

---

## The Bottom Line

Vibe coding will always have its place for quick prototypes and creative exploration. But for production quality, maintainable solutions - agentic coding not only a great opportunity for acceleration - it can be sustainable.

The future belongs to developers who can effectively collaborate with AI agents. The question isn't whether AI will change how we code—it's whether we'll evolve our practices to harness that change responsibly.

*See also - my [agentic coding workflow guide](https://smcleod.net/2025/04/my-plan-document-act-review-flow-for-agentic-software-development/) and [live demo recording](https://smcleod.net/2025/02/agentic-coding-live-demo-/-brownbag/).*
