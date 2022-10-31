---
author: "Sam McLeod"
readingTime: true
categories: [ Tech, security-privacy ]
date: "2015-02-23T00:00:00Z"
aliases:
  - /tech/2015/02/23/delete-known-governmentlinked-certificate-authorities-in-os-x/
image: backdrop-italian-steps.jpg
featuredImagePreview: backdrop-italian-steps.jpg
tags:
- tech
- security
- privacy
title: Delete Government-Linked Certificate Authorities in OSX
---


[Inspired by http://zitseng.com/archives/7489](http://zitseng.com/archives/7489)

* [Source (Github)](https://github.com/sammcj/delete-unknown-root-ca)

**WARNINGS**

* Do not run unless you understand what this is doing
* The CA system is broken by design - This is not a fix for that
* This is merely a band-aid for those interested or concerned about these root CAs


## Usage

```shell
chmod +x delete_gov_roots.sh
./delete_gov_roots.sh
```

You'll be prompted for your password as root access is required to delete system-wide root certs.

![sha1](https://cloud.githubusercontent.com/assets/862951/6326428/a261ae24-bba5-11e4-9f69-5aeb36257077.png)

## See Also

* <http://convergence.io>
* <https://addons.mozilla.org/en-US/firefox/addon/certificate-patrol/>
* <https://github.com/kirei/catt>
* <https://www.eff.org/observatory>
* <https://bugzilla.mozilla.org/show_bug.cgi?id=478418>
* <http://support.apple.com/en-us/HT202858>
* <https://www.owasp.org/index.php/Certificate_and_Public_Key_Pinning>
