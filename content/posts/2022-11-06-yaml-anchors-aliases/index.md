---
title: "YAML Anchors and Aliases"
description: "Using YAML Anchors and Aliases to make config files more DRY"
subtitle: ""
date: 2022-11-06T15:52:27+11:00
lastmod: 2022-11-06T08:52:27+11:00
author: Sam McLeod
description: ""
keywords: ["yaml"]

tags: ["yaml", "DRY"]
categories: ["Software"]
series: []

image: &image "Official_YAML_Logo.png"

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
comments: true
comment:
  enable: true
---


The YAML Spec defined a simple way to reuse values in YAML documents by means of [Anchors and Aliases](https://yaml.org/spec/1.2/spec.html#id2765878).

- Anchors (`&`) are used to define a value.
- Aliases (`*`) are used to reference a value.
  - Overrides (`<<:`) are used to merge values.

## Example

This may look more complicated at first, but once you know what it's doing it's _very_ simple and can greatly reduce the amount of duplication in your YAML files and with that the risk of config drift and copy/pasta errors.

```yaml
simple-anchor: &hw "echo Hello World"
env: &env-common
  - MY_ENV_VAR_1: "my value 1"
  - MY_ENV_VAR_2: "my value 2"
  - MY_ENV_VAR_3: "my value 3"
with: &with-common
  my-input: "my value"
  my-secret-input: ${{ secrets.SECRET }}
...
    steps:
      - name: "Hello"
        run: *hw
        env:
          - SPECIAL_VAR: "my special value"
          <<: *env-common
          <<: *with-common
      - name: "World"
        run: *hw
        env:
          <<: *env-common
          <<: *with-common
```

Let's break that down:

## Define YAML Anchors

```yaml
simple-anchor: &hw "echo Hello World"      # Create an anchor named 'hw' with the value "echo Hello World"
env: &env-common                           # Create an anchor named 'env-common' with the values that follow
  - MY_ENV_VAR_1: "my value 1"
  - MY_ENV_VAR_2: "my value 2"
  - MY_ENV_VAR_3: "my value 3"
with: &with-common                         # Create an anchor named 'with-common' with the values that follow
  my-input: "my value"
  my-secret-input: ${{ secrets.SECRET }}
```

## Use YAML Anchors

```yaml
    steps:
      - name: "Hello"
        run: *hw                            # Use Alias 'hw' which results in run: "run: echo Hello World"
        env:
          - SPECIAL_VAR: "my special value"
          <<: *env-common                   # Use Alias 'env-common' with override (<<:) to merge into existing values
                                            # (env:
                                            #         - SPECIAL_VAR: "my special value"
                                            #         - MY_ENV_VAR_1: "my value 1"
                                            #         - MY_ENV_VAR_2: "my value 2"
                                            #         - MY_ENV_VAR_3: "my value 3")
          <<: *with-common                  # Use Alias 'with-common' with override to merge into existing values
                                            #         my-input: "my value"
                                            #         my-secret-input: ${{ secrets.SECRET }})
```

And that's it!
