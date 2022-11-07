---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-09-22T00:00:00Z"
aliases:
  - /tech/2015/09/22/replacing-junos-pulse-with-openconnect/
images: ["backdrop-zbuildings.jpg"]
featuredImagePreview: backdrop-zbuildings.jpg
tags:
- tech
- networking
title: Replacing Junos Pulse with OpenConnect
---

In an attempt to avoid using the Juniper Pulse (Now Pulse Secure) VPN client we tried OpenConnect but found that DNS did not work correctly when connected to the VPN.
This bug has now been resolved recently but has not made it's way into a new build, in fact there have been no releases for 6 months.

Luckily the OpenConnect was not too difficult to build from source.

## Build OpenConnect on OSX

### Remove old openconnect and install deps

```shell
brew remove openconnect
brew install libxml2 lzlib openssl libtool libevent
```

### Build openconnect

```shell
wget git.infradead.org/users/dwmw2/openconnect.git/snapshot/0f1ec30d17aa674142552e275bf3fac30d891b39.tar.gz
tar zxvf 0f1ec30d17aa674142552e275bf3fac30d891b39.tar.gz
cd openconnect-0f1ec30

LIBTOOLIZE=glibtoolize ./autogen.sh
PATH=/usr/local/opt/gettext/bin:$PATH
./configure
make
make install
```

### To connect

```shell
sudo openconnect --juniper -u myusername www.myserver.com
```

If you're comfortable with allowing admin users to run openconnect without entering a sudo password, add the following using `sudo visudo`:

```shell
%admin  ALL=(ALL) NOPASSWD: /usr/local/sbin/openconnect
```
