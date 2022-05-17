---
title: Firefox Addons for 2022
excerpt: "My list of must-have Firefox addons - 2022 edition"
date: '2022-05-16 08:00:00'
categories: software
author_url: "/author/sam"
header:
  teaser: img/firefox-logo-collage-1.png
featured: true
tags:
  - software
---

![](/img/firefox-logo-collage-1.png)

# Firefox Addons - 2022 Edition

My list of must-have Firefox addons - 2022 edition

## Privacy and Security

- [Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers)
  - Setting sites such as Amazon, eBay, Twitter, LinkedIn, Banking etc... each to always open in their own container
- [Don't Track Me Google](https://addons.mozilla.org/en-GB/firefox/addon/dont-track-me-google1)
- [UTM Tracking Token Stripper](https://addons.mozilla.org/en-GB/firefox/addon/utm-tracking-token-stripper)
- The official addon for whatever Password Manager you use ([1Password](https://addons.mozilla.org/en-GB/firefox/addon/1password-x-password-manager/), [Bitwarden](https://addons.mozilla.org/en-GB/firefox/addon/bitwarden-password-manager/) etc...) 

### uBlock Origin

Probably the single most important addon.

- [uBlock Origin](https://addons.mozilla.org/en-GB/firefox/addon/ublock-origin)

1. Enable and update all built-int filter lists except for 'Regions' and 'Languages'.
2. Under 'Trusted Sites' add your local IP range (e.g. `192.168.0.0/24`) and local hostnames if you run any local web servers (e.g. `https://my-home-server.local`
3. Enable 'Cloud Storage' (if you use Firefox sync) and upload your config tabs.

## Quality of Life Improvements

- [Bypass Paywalls Clean](https://addons.mozilla.org/en-GB/firefox/addon/bypass-paywalls-clean)
- [SponsorBlock - Skip Sponsorships on YouTube](https://addons.mozilla.org/en-GB/firefox/addon/sponsorblock)
- [FastForward](https://addons.mozilla.org/en-GB/firefox/addon/fastforwardteam/)
- [Copy PlainText](https://addons.mozilla.org/en-GB/firefox/addon/copy-plaintext)
- [Awesome RSS](https://addons.mozilla.org/en-GB/firefox/addon/awesome-rss)
- [Night Mode - Hacker News](https://addons.mozilla.org/en-GB/firefox/addon/night-mode-hacker-news)

## For AWS Users

- [Console Recorder for AWS](https://addons.mozilla.org/en-GB/firefox/addon/console-recorder)
- [Former2 Helper](https://addons.mozilla.org/en-GB/firefox/addon/former2-helper)

## Other Configuration

- Settings -> Privacy & Security -> Strict Tracking Protection (more information [here](https://blog.privacyguides.org/2021/12/01/firefox-privacy-2021-update))

### about:config

- `mousewheel.with_meta.action: 0` - Disable scroll zooming
- `extensions.pocket.enabled: false`- Disable Pocket
- `dom.event.clipboardevents.enabled: false` - Don't allow websites to prevent copy and paste, stop webpage knowing which part of the page had been selected.

### uBlock Origin Rules

Add the following to "My Filters"

- The content of [ublacklist github translation](https://raw.githubusercontent.com/arosh/ublacklist-github-translation/master/uBlacklist.txt)
- The content of [ublacklist stackoverflow translation](https://raw.githubusercontent.com/arosh/ublacklist-stackoverflow-translation/master/uBlacklist.txt)

```
# Remove tracking tokens
*$removeparam=utm_source
*$removeparam=fbclid
*$removeparam=gclid
*$removeparam=utm_source
*$removeparam=utm_medium
*$removeparam=utm_term
*$removeparam=utm_campaign
*$removeparam=utm_content
*$removeparam=utm_cid
*$removeparam=utm_reader
*$removeparam=utm_referrer
*$removeparam=utm_name
*$removeparam=utm_social
*$removeparam=utm_social
*$removeparam=igshid
*$removeparam=ICID
*$removeparam=rb_clickid

! block pinterest rubbish on google
google.*##.g:has(a[href*=".pinterest.*"])
google.*##a[href*=".pinterest."]:upward(1)

! Block pinterest rubbish on ddg
duckduckgo.*##.results > div:has(a[href*=".pinterest.com"])
```
