---
layout: post
title: Continuous Integration for the Linux Kernel - Built within Docker
categories: []
tags: [dev,ops,kernel,gitlab]
published: True
excerpt_separator: <!--more-->
image:
  feature:
  credit:
  creditlink:
---
Builds a Debian package of the latest stable linux kernel.

Runs in an isolated and disposble docker container.
Tested with Gitlab-CI but should work on any CI system.
No root access is required for the build.

After a successfully building the kernel package, the kernel will be copied to /mnt/storage on the host. Once the kernel package is on the host, you can install it on any Debian Wheezy AMD64 machine or upload it to your local apt repo for deployment.

[Code - https://github.com/sammcj/kernel-ci](https://github.com/sammcj/kernel-ci)

![Gitlab-Kernel-CI](images/ci/kernelci.png)
