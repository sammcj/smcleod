---
title: "Defaulting git clone to shallow (depth=1)"
subtitle: "Shallow clones are faster and smaller"
date: 2023-05-29T08:53:24+10:00
lastmod: 2023-05-29T08:53:24+10:00
author: Sam McLeod
description: ""
keywords: ["Git", "Scripting", "ZSH", "Bash", "Shell"]
tags: ["Git", "Scripting", "ZSH", "Bash", "Shell"]
categories: ["Scripting", "ZSH", "Git"]
series: ["ZSH"]

hiddenFromHomePage: false
hiddenFromSearch: false

toc:
  enable: false
  auto: false
asciinema: false
math: false
lightgallery: false
readingTime: true
showFullContent: true
draft: false
type: posts

code:
    maxShownLines: 100
    copy: true

comment:
  enable: false
---

<!-- markdownlint-disable MD025 -->

Before adding this to my shell config, I would manually add --depth=1 to all my git clones.
<!--more-->
I never saw the value in downloading the entire source history and (at times incorrectly) committed files to my local machine unless I was cloning the repo for the purpose of backing it up.

It seems strange to me that git doesn't have a config option to set this as default behaviour.

<!--more-->

My hack for this is [a simple zsh/bash function](https://github.com/sammcj/zsh-bootstrap/blob/a55cae3421fe8e2144b9c1f30bf07180966a7a58/9-functions.rc#L20) that can wrap git commands - and as such add clone depth if it's not specified.

```bash
function git_wrapper() {

# If invoked by another function, alias or xargs, interpret it as normal

  if [[ -n ${FUNCNAME[*]} ]] || [[ -n $ALIASES ]] || [[ -n $XARGS ]]; then
    command git "$@"
    return
  fi

# clone with depth=1 if no depth is not specified

  if [[ $1 == "clone" ]] && [[ $* != *"--depth"* ]]; then
    shift
    command git clone --depth=1 "$@"
  else
    command git "$@"
  fi
}

alias git='git_wrapper'
```

Maybe there's a better way of doing this?
