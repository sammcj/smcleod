---
author: "Sam McLeod"
readingTime: true
categories: [ DevOps ]
date: "2020-11-18T14:00:00Z"
aliases:
  - /tech/2020/11/18/team-charter/
images: ["pexels-denniz-futalan-2306897.jpg"]
featuredImagePreview: pexels-denniz-futalan-2306897.jpg
tags:
- DevOps
title: DevOps Team Charter
---

A template team charter for software and platform engineering teams.

Research[^1] shows there is great value in people embracing a shared vision and ideas that are bigger than themselves.

When it comes to a team charter, it's important to remember that it's not a static document. It's a living document that should be updated as the team evolves and grows.

Keep in mind that

- One size doesn't fit all.
- Consider your (teams) mission, cultural background and values.
- While not exhaustive - this is on the longer side, you may wish to distill as is practical, but I implore you not to only pick the easier items - that's missing the point.
- These can give you talking points when performing postmortems, retros and during times of conflict.

_See also: '[Using Old Ways of Thinking to Apply New Ways of Working](https://itrevolution.com/antipattern-1-2-using-old-ways-of-thinking-to-apply-new-ways-of-working/)' and '[BVSSHJ Principles](https://itrevolution.com/bvssh-principles/)'_.

With all that in mind, here's a template I use when working with teams, it is not designed to be used as-is, but rather the relevant parts should be distilled and used as a concise starting point for discussion.

## Charter

### Platform Engineering - Team Charter

This team charter is an introductory document that sets the vision, mission, values, culture and communication protocols for our Platform Engineering team.

#### Team Vision / Mission Statement

{{< admonition tip >}}
Remember to add your vision and mission statement(s) to your teams landing page on your wiki.
{{< /admonition >}}

“To enable, empower and add value to the business, coworkers and customers by building, running, maintaining and improving the (cloud) platforms and services including infrastructure, automation, platform integrations and CI/CD tooling used by engineers and applications.”

#### Team Values

_Pick 5-10_

- We value focusing on outcomes rather than output.
- We value working on a trust, but verify model, utilising guard rails to help protect our systems while empowering our colleagues.
- We value small, easy to review, incremental changes over large, slow moving changes.
- We value that perfect is often the enemy of good.
- We value that rework is better than no work.
- We value finishing work over starting work.
- We value having empathy and respect for our peers.
- We value automation over manual tasks or changes.
- We value solutions that add business value over technical value.
- We value simple rather than complex solutions.
- We value the use of widely adopted tooling and solutions over creating bespoke development.
- We value pulling work over pushing work.
- We value working in small teams of 3 to 6 people.
- We value measuring our assumptions.
- We value fast feedback.
- We value change rather than fear it.
- We value open communication among the team.
- We value evidence based conclusions.
- We value loosely coupled, tightly integrated systems.
- We value breaking down silos and barriers, there is no us and them - only us.
- We value taking the sensible, applicable practices and ways of working from product delivery frameworks and cultural movements rather than trying to 'implement' them.
- We value light touch interfaces, systems and processes over those that create toil (work you don't want to do).
- We value sharing knowledge and have a centralised repository which can be searched by anyone in the organisation.
- We value that the people are more important than the tools.
- We value mistakes for the lessons they teach us.

#### Team Culture and Code of Conduct

{{< admonition tip >}}
Remember to add them to your teams landing page on your wiki, and to applicable software repositories.
{{< /admonition >}}

_Pick 3-5_

- We operate with and embrace an empathetic, blameless culture of psychological safety (everyone feels safe and no one is afraid to make mistakes, and can show and employ one's self without fear of negative consequences of self-image, status or career).
- We respect each other's time (work/life balance, start / finishing hours and timezones).
- We ask for help when we need it.
- We support team members when they ask for help.
- We operate as peers.
- We assume that the intentions of our coworkers are good.
- We expect that feedback should be constructive with the objective of uplifting and empowering those around us.
- We recognise and celebrate all individual and team accomplishments.
- We respect that people need to maintain a work / life balance in order to be healthy, happy and effective.
- We work collaboratively when possible and use a consensus approach when making team decisions but accept that the team lead may act as a tiebreaker or need to make final calls.
- We understand and appreciate that not all team members can have the same level of knowledge across all systems and tooling, from that we leverage that each individual adds value in different ways.
- When making major architectural decisions, we document the decisions made.
- When delegation is required, we agree to clearly communicate and make the delegation visible.

#### Team Communication

{{< admonition tip >}}
Remember to add them to your teams landing page on your wiki.
{{< /admonition >}}

_Pick 3-5_

- We try to listen rather than to hear.
- We try to understand the views and values of others.
- We value transparency so that we may learn from each other.
- We have agreed on and have documented our core working and core meeting hours.
- We communicate with constructive, positive feedback.
- We communicate with principled negotiation rather than positional bargaining.
- We communicate with direct feedback over indirect (slow) feedback.
- We prepare for and arrive on time for meetings / workshops whenever possible.
- We avoid holding meetings without value or without agendas.
- We avoid holding meetings too early or late in the day.
- We value asynchronous communication when appropriate (e.g. the message is not urgent, should be viewed by multiple people when suits them etc…).

---

### Real Work Example

To quote [Grant Sutton](https://www.linkedin.com/in/grant-d-sutton/?originalSubdomain=au) from [DigIO](https://digio.com.au):

> Back when I was on a team we used **"Rework is better than no work"** as one of our core principles.
>
> There were several times on the project where we could have been effectively stuck waiting of API specifications to be finalised.
>
> In those cases someone from the team would remind the other "Rework is better than no work", and we'd start working off whatever information we had, even if it was just content from developers in Slack messages.
>
> There were many occasions where the early development that we did either identified problems, or drove changes to the API that wouldn't have happened if we had waited.

_See also: Grant's post on '[Dev Mantras — A Team Charter Anti-Pattern](https://medium.com/digio-australia/dev-mantras-a-team-charter-anti-pattern-7a2b6f8369fa)'_

[^1]: <https://hbr.org/2021/05/high-performing-teams-start-with-a-culture-of-shared-values>
