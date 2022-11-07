---
author: "Sam McLeod"
readingTime: true
categories: [ Tech, CICD ]
date: "2015-03-15T00:00:00Z"
aliases:
  - /tech/2015/03/15/kernel-ci/
  - /continuous-integration-for-the-linux-kernel-built-within-docker
images: ["backdrop-zbuildings.jpg"]
featuredImagePreview: backdrop-zbuildings.jpg
tags:
- tech
- DevOps
- cicd
title: Continuous integration for the Linux Kernel - Built within Docker
---


Linux Kernel CI for Debian

![]({{< ref "/" >}}/img/build-passing.png)

[Github: sammcj/kernel-ci](https://github.com/sammcj/kernel-ci)

Those of us using technologies such as Docker and BTRFS or simply trying to gain a performance edge on the competition have a lot to gain from the features and performance of recent Kernel updates (especially from 3.18 onwards).


'Enterprise' Linux distributions such as RHEL & variants are concerningly out of date when comes to the Kernel.
Many people seem to have forgotten what Linux is... _Linux IS the Kernel_.

Someone said to me recently 'Why do I need a more modern Kernel? - It never gives us problems!' later in the conversation they alluded to a number of performance issues they were experiencing with both a database platform and with some modern containerised applications they were trying to run. _Both of those issues were resolved several years ago in the Kernel which was newer than what they were running_.

There's a fine line between bleeding edge and being at the front of the game, if there's one thing I've learnt about this over the past few years it's that the Kernel gets better with age, not worse.

In addition to CI of modern Kernel images, I've also integrated (optional) patching for GRSecurity fixes - GRSecurity is a great line of defence for the Kernel and prevents applications doing many silly things they shouldn't be allowed to do (Can anyone say Nodes?...).

- Uploads publicly accessable Debian Kernel Packages to packagecloud.io
- Includes Kernel Watcher that detects new stable kernel releases and triggers builds.
- Supports patching the Kernel with GRSecurity
- Tested with Gitlab-CI and Travis-CI but should work on any CI system.
- Runs in an isolated and disposble docker container.
- No root access required when building with Docker.
- Both the build and the kernels Work with Debian Wheezy (7) and Jessie (8).
- Supports uploading built packages to a remote server and adding them to reprepro

![]({{< ref "/" >}}/img/travis.png)

![]({{< ref "/" >}}/img/kernel_bash.jpg)
