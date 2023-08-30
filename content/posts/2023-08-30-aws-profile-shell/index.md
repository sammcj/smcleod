---
title: "AWS Profile helper"
subtitle: ""
date: 2023-08-30T07:11:37
lastmod: 2023-08-30T07:41:37
author: Sam McLeod
description: "A helper function to make it easier to login to AWS using saml2aws and a password stored in keychain."
keywords: ["Git", "Scripting", "ZSH", "Bash", "Shell", "AWS"]
tags: ["Git", "Scripting", "ZSH", "Bash", "Shell", "AWS"]
categories: ["Scripting", "ZSH", "Git", "AWS"]
series: ["ZSH"]

# featuredImagePreview: ""
hiddenFromHomePage: false
hiddenFromSearch: false
toc:
  enable: true
  auto: false
code:
  copy: true
  maxShownLines: 200
math: false
lightgallery: false
readingTime: false
showFullContent: false
asciinema: false
mermaid: true
draft: true #TODO:
---

A helper function to make it easier to login to AWS using saml2aws and a password stored in keychain.

# TODO: insert gif here

<!--more-->

## Usage

```bash
aws-profile
# or
aws-profile <profile name>
```

## Script

```bash
# aws-profile uses s2a-keychain to login to AWS using saml2aws and then exports the AWS_PROFILE variable

# Interactively export AWS_PROFILE
function aws-profile() {
  # if provided an argument, use that as the profile
  if [[ -n $1 ]]; then
    export AWS_PROFILE="$1"
    export AWSCLIPARAMS="--profile=$1"
  else
    # otherwise, use fzf to select a profile
    AWS_PROFILE=$(grep profile "${HOME}"/.aws/config |
      awk '{print $2}' | sed 's,],,g' |
      fzf --layout reverse --height=30% --border)
    export AWS_PROFILE
    export AWSCLIPARAMS="--profile=${AWS_PROFILE}"
  fi

  # Check if we've already got a session
  if [[ -n $(aws --profile="${AWS_PROFILE}" sts get-caller-identity) ]]; then
    echo "You already have a session, would you like to refresh it? (y/n)"
    read -r REFRESH_SESSION
    if [[ $REFRESH_SESSION == "y" ]]; then
      # s2a login "$AWS_PROFILE"
      s2a-keychain "$AWS_PROFILE"
    fi
  fi

  echo "[You are now using the ${AWS_PROFILE} profile]"
}

# Logs into AWS using saml2aws and a password stored in keychain
function s2a-keychain() {
  local IDPPW INPUT_PROFILE KEYCHAIN_PW
  KEYCHAIN_PW=${KEYCHAIN_PW:-"awsazurepw"}
  SAML2AWS_CONFIGFILE=${SAML2AWS_CONFIGFILE:-"${HOME}/.saml2aws"}
  INPUT_PROFILE=${1:-"default"}

  IDPPW=$(keychain_password "$KEYCHAIN_PW") # requires mfa and keychain authentication

  aws configure list --profile "${INPUT_PROFILE}"

  set -e
  # Login to AWS
  saml2aws login -a "$INPUT_PROFILE" \
    --skip-prompt \
    --password="$IDPPW" \
    --profile="$INPUT_PROFILE" \
    --cache-saml &&
    export AWS_PROFILE="$INPUT_PROFILE" &&
    export AWSCLIPARAMS="--profile=${INPUT_PROFILE}" &&
    export AWS_DEFAULT_REGION=ap-southeast-2
  unset IDPPW
  set +e
}


# Prompts for a name and a password and stores it in keychain
keychain_password_prompt() {
  echo "Enter a name for the password:"
  read -r name
  echo "Enter the password:"
  # disable echoing the password
  stty -echo
  read -r password
  security add-generic-password -s "$name" -a "$(whoami)" -w "$password"
}

alias awslogin=aws-profile
```

## Requirements

- saml2aws
- aws-cli
- fzf
- awk
- macOS keychain (if you want to store your password in keychain)
