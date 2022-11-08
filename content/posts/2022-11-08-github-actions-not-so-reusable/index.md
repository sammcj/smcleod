---
title: "Github Not-So-Reusable Actions"
description: "Github Actions Reusable Workflows vs Composite Actions"
subtitle: ""
date: 2022-11-06T15:52:27+11:00
lastmod: 2022-11-08T08:52:27+11:00
author: Sam McLeod
description: ""
keywords: ["github", "ci", "yaml"]

tags: ["github", "ci", "yaml", "DRY"]
categories: ["Software", "Github"]
series: []

image: &image "old-man-yells-at-github-actions.png"

featuredimage: *image
featuredImagePreview: *image
images: [*image]

hiddenFromHomePage: false
hiddenFromSearch: false

toc: true
asciinema: false
math: false
lightgallery: false
readingTime: true
showFullContent: false
draft: false
---

Github Actions is a "BYOBE" (Bring Your Own Bloody Everything) offering that provides basic CI with surprisingly convoluted configuration to Github.

The product as a whole is an exercise in frustration, one of the worst parts is the lack of reusability and the complexity required to achieve it. Github's concept of reusable workflows on Github Actions is clearly a cobbled together afterthought.

There's no one way to reuse workflows - you can't simply include / inherit FROM another workflow and no support for standard YAML anchors/aliases[^1].

- [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [Composite Actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)

---

## Composite Actions

Composite actions are a way to combine multiple steps into a single step. They are a way to reuse [steps](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idsteps), but not [workflows](https://docs.github.com/en/actions/using-workflows/about-workflows).

- Booleans in composite actions are actually Strings - even if you set their type to Boolean[^2]. 🤦
- Composite Actions requires setting the shell in each step (`shell: bash`).
- Composite Actions requires setting run.using as composite in each workflow (`runs.using: "composite"`).
- Composite Actions can be called as part of one of the steps in a job.
- Composite Actions can include multiple files, so it's possible to use files from the Action or from the user's repository.
- Composite Actions can include multiple steps, but not multiple jobs.
- Composite Actions do not support `${{ secrets.mysecret }}`, a workaround is to pass the secrets as input parameters from calling workflow. 🤦

### Example {#composite-action-example}

Composite Action

```yaml
name: Composite Action Example
description: "Composite Action Example"

inputs:
  my-input:
    description: 'Input for the composite action'
    required: true
    default: 'Hello World'
  my-secret-input:
    description: 'Secret input for the composite action'
    required: true

runs:
  using: "composite"
  steps:
    - name: Hello
      run: echo world
      shell: bash
    - name: Do something secret
      shell: bash
      run: login -p ${{ inputs.my-secret-input }}
```

Calling Workflow

```yaml
...
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - name: hello world
        uses: actions/helloworld@v3

      - uses: myorg/my-reusable-repo/.github/actions/my-action@main
        with:
          node-auth-token: ${{ secrets.SUPER_SECRET_TOKEN }}
...
```

---

## Reusable Workflows

A reusable workflow is similar to normal GitHub Actions workflow, however:

- Reusable workflows cannot call other reusable workflows.
- Reusable workflows cannot accept matrix input (`strategy.matrix`).
- Reusable workflows are a single YAML file, with no additional files retrieved by default.
- Reusable workflows are called as a job - but cannot contain steps in the calling workflow.
  - The reusable workflow itself can have multiple steps.
- Reusable workflows can include multiple jobs, and multiple steps in each job.
- Reusable workflows are defined through the `workflow_call` event type.
  - "Regular" (non-reusable) Workflow can be triggered through a `workflow_dispatch` event.
  - Both event types support `input` - however with dispatchable Workflows `input` object is `${{ github.event.inputs }}` where as callable workflows receive `${{ inputs }}` 🤦.
  - As a result, in order to make a reusable workflow dispatchable, a wrapper workflow may be required.
- Unlike Composite Actions, Booleans in Reusable Workflows _are_ Booleans.

### Example {#reusable-workflow-example}

Reusable Workflow

```yaml
name: Reusable Workflow Example

on:
  workflow_call:

jobs:
  hello-world:
    name: "Example job in a reusable workflow"
    runs-on: ubuntu-22.04
    steps:
      - uses: "actions/checkout@v3"
        with:
          repo_token: ${{ secrets.GITHUB_TOKEN }}
```

Calling Workflow

```yaml
...
jobs:
  hello-world:
    uses: myorg/my-reusable-repo/.github/workflows/my-action.yml@main
    with:
      secrets: inherit
...
```

---

## (I Can't Get No) YAML Anchors

As a side note - the YAML Spec defined a simple way to reuse values in YAML documents by means of [Anchors and Aliases](https://yaml.org/spec/1.2/spec.html#id2765878).

If you haven't used them before (and don't worry - you can't on Github) - I have an example [here](../yaml-anchors-and-aliases)

Unfortunately despite requests[^1] to[^3] do[^4] so[^5] - Github Actions does not support YAML anchors or aliases.

While obviously not a solution for reusable workflows - these would make large workflows a lot simpler and easier to maintain and as such reduce reliance on the band aid solutions that are _Reusable Workflows_ and _Composite Actions_.

---

[^1]: [GitHub Actions: Support YAML anchors](https://github.com/actions/runner/issues/1182)
[^2]: [Github Booleans are only _sometimes_ Booleans](https://github.com/actions/runner/issues/1483)
[^3]: [Support YAML anchors](https://github.com/community/community/discussions/4501)
[^4]: [Support YAML anchors](https://github.com/actions/starter-workflows/issues/162)
[^5]: [Support YAML anchors](https://github.com/actions/runner/issues/438#issuecomment-722778085)
