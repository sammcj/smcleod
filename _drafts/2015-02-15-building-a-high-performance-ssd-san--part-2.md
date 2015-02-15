---
layout: page
title: Building a high performance SSD SAN - Part 2
categories: []
tags: [ops,storage]
published: Flase
excerpt_separator: <!--more-->
image:
  feature:
  credit:
  creditlink:
---

## Resources

* [Server Manual](http://www.supermicro.com.tw/manuals/superserver/1U/MNL-1724.pdf)
* [Firmware](ftp://www.supermicro.com.tw/CDR_Images/CDR-X10/)
* [BIOS](http://www.supermicro.com.tw/support/bios/firmware.aspx)

1. Go through the usual steps of setting up the BIOS / IPMI and updating firmware.
1. Install OS on SATA DOMs
1. Configure 2x SATA DOMs in an mdadm RAID1 mirror using the Debian installer.
1. I'm making the root file system 10GB and /var 6GB both EXT4 on LVM.
1. Install the minimal Debian package set.
1. Edit /etc/fstab and add noatime,discard to any mounted EXT4 filesystems
1. Add Debian backports mirror to apt sources and run apt-get update; apt-get upgrade
1. Install the latest kernel from backports (apt-get install -t wheezy-backports linux-image-amd64, reboot and remove the old 3.2 kernel

I'll be installing the following packages on top of the base system:

```vim-full htop iotop hdparm mtr fio open-iscsi ssh openntpd drbd-utils heartbeat cron-apt rsync tcpdump tmux```