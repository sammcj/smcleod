---
author: "Sam McLeod"
readingTime: true
categories: [ software ]
date: "2022-05-17T08:00:00Z"
aliases:
  - /software/2022/05/16/firefox-addons-2022/
image: firefox-logo-collage-1.png
featuredImagePreview: firefox-logo-collage-1.png
tags:
- software
title: Firefox Addons for 2022
---

<!-- markdownlint-disable MD025 -->
## Firefox Addons - 2022 Edition

My list of must-have Firefox addons - 2022 edition

Updated: 2022-10-09

### Privacy and Security

Firstly - you should have [Firefox's Enhanced Tracking Protection](https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop) enabled.

- [Don't Track Me Google](https://addons.mozilla.org/en-GB/firefox/addon/dont-track-me-google1)
- [LocalCDN](https://addons.mozilla.org/en-GB/firefox/addon/localcdn-fork-of-decentraleyes/)
- [UTM Tracking Token Stripper](https://addons.mozilla.org/en-GB/firefox/addon/utm-tracking-token-stripper)
  - *Note: You can accomplish some of what this does by setting up the `removeparam` uBlock origin rules I've listed below.*
- [Multi-Account Containers](https://addons.mozilla.org/en-GB/firefox/addon/multi-account-containers)
  - *Useful for setting sites such as Amazon, eBay, Twitter, LinkedIn, Banking etc... each to always open in their own isolated container.*
- The official addon for whatever Password Manager you use.
- [Firefox Translations](https://browser.mt/)

#### uBlock Origin

Probably the single most important addon.

- [uBlock Origin](https://addons.mozilla.org/en-GB/firefox/addon/ublock-origin)

1. Enable and update all built-int filter lists except for 'Regions' and 'Languages'.
2. Under 'Trusted Sites' add your local IP range (e.g. `192.168.0.0/24`) and local hostnames if you run any local web servers (e.g. `https://my-home-server.local`
3. Enable 'Cloud Storage' (if you use Firefox sync) and upload your config tabs.

### Quality of Life Improvements

- [Bypass Paywalls Clean](https://addons.mozilla.org/en-GB/firefox/addon/bypass-paywalls-clean)
- [SponsorBlock - Skip Sponsorships on YouTube](https://addons.mozilla.org/en-GB/firefox/addon/sponsorblock)
- [FastForward](https://addons.mozilla.org/en-GB/firefox/addon/fastforwardteam/)
- [Copy PlainText](https://addons.mozilla.org/en-GB/firefox/addon/copy-plaintext)
- [Awesome RSS](https://addons.mozilla.org/en-GB/firefox/addon/awesome-rss)
- [Night Mode - Hacker News](https://addons.mozilla.org/en-GB/firefox/addon/night-mode-hacker-news)
- [Upvote Anywhere](https://addons.mozilla.org/en-CA/firefox/addon/upvote-anywhere/)
- [Refined Github](https://github.com/refined-github/refined-github)

### For AWS Users

- [Console Recorder for AWS](https://addons.mozilla.org/en-GB/firefox/addon/console-recorder)
- [Former2 Helper](https://addons.mozilla.org/en-GB/firefox/addon/former2-helper)

## Other Configuration

- Settings -> Privacy & Security -> [Strict Tracking Protection](https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop) (more information [here](https://blog.privacyguides.org/2021/12/01/firefox-privacy-2021-update))

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

---

## A note on 1Password

[1Password](https://addons.mozilla.org/en-GB/firefox/addon/1password-x-password-manager/)

While I don't have an issue with their browser extension by itself - I can no longer recommend the desktop / 'application' version 1Password as of version 8.

Since raising more capital 1Password has been chasing quick development of new features and have stopped native application development.

1Password 8 is unfortunately an Electron (Chrome) web-frame application. This has a lot of negative implications for security, performance and in itself is a statement of the direction that 1Password is taking moving forward.

So - what are the alternatives?

For a desktop and mobile application [Strongbox](https://strongboxsafe.com) is by far the leading contender.

They are actively working on an [official Firefox addon which in beta](https://addons.mozilla.org/en-GB/firefox/addon/strongbox-autofill/) which is currently in beta - so watch this space!

In the mean time as Strongbox uses the standard KeyPassX format you can use the [KeePassXC-Browser](https://addons.mozilla.org/en-GB/firefox/addon/keepassxc-browser/) addon to access your Strongbox database within Firefox.
