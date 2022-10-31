---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-02-15T00:00:00Z"
aliases:
  - /tech/2015/02/14/xenserver-ssds-vm-storage-performance
image: noah-kuhn-27481.jpg
featuredImagePreview: noah-kuhn-27481.jpg
tags:
- tech
- storage
- hardware
- xen
title: XenServer, SSDs & VM Storage Performance
---

## Intro

At Infoxchange we use XenServer as our Virtualisation of choice.
There are many reasons for this including:

* Open Source.
* Offers greater performance than VMware.
* Affordability (it's free unless you purchase support).
* Proven backend Xen is very reliable.
* Reliable cross-host migrations of VMs.
* The XenCentre client, (although having to run in a Windows VM) is quick and simple to use.
* Upgrades and patches have proven to be more reliable than VMware.
* OpenStack while interesting, is not yet reliable or streamlined enough for our small team of 4 to implement and manage.
* XenServer Storage & Filesystems

Unfortunately the downside to XenServer is that it's underlying OS is quite old.
The latest version (6.5) about to be released is still based on Centos 5 and still lacks any form of EXT4 and BTRFS support, direct disk access is not available… without some tweaking and has no real support for TRIM unless you have direct disk access and are happy with EXT3.

Despite this, XenServer still manages to easily outperform VMware in both storage and CPU performance while costing… nothing unless you purchase support!

## Direct disk access

It turns out, that you can add custom udev rules to pass through devices directly to VMs.

For example, assuming `/dev/sdb` is the disk you wish to make available to guests, you can edit `/etc/udev/rules.d/50-udev.rules` like so:

```shell
ACTION=="add", KERNEL=="sdb", SYMLINK+="xapi/block/%k", RUN+="/bin/sh -c '/opt/xensource/libexec/local-device-change %k 2>&1 >/dev/null&'"
ACTION=="remove", KERNEL=="sdb", RUN+="/bin/sh -c '/opt/xensource/libexec/local-device-change %k 2>&1 >/dev/null&'"
```

There are some limitations with this:

You're passing through the whole disk and can only grant that entire disk to a single VM.
The udev configuration is volitile and is likely to be lost upon installing XenServer updates.
You cannot (to my knowledge) boot from directly attached storage devices.
What I've actually done is partitioned the SSD RAID array into 4 paritions on the XenServer host, this allows me to carve up the SSD RAID array and present adiquit storage to several VMs on the host.
i.e.

```shell
ACTION=="add", KERNEL=="sdb1", SYMLINK+="xapi/block/%k", RUN+="/bin/sh -c '/opt/xensource/libexec/local-device-change %k 2>&1 >/dev/null&'"
ACTION=="remove", KERNEL=="sdb1", RUN+="/bin/sh -c '/opt/xensource/libexec/local-device-change %k 2>&1 >/dev/null&'"
ACTION=="add", KERNEL=="sdb2", SYMLINK+="xapi/block/%k", RUN+="/bin/sh -c '/opt/xensource/libexec/local-device-change %k 2>&1 >/dev/null&'"
ACTION=="remove", KERNEL=="sdb2", RUN+="/bin/sh -c '/opt/xensource/libexec/local-device-change %k 2>&1 >/dev/null&'"
```

etc…

I've then:

* Mapped each partition to a VM running on that host.
* Partitioned it within the host as needed.
* Mounted /var/lib/docker as a BTRFS volume with compression enabled (compress=lzo) - This is used by CI as we build our our applications in Docker.
* Mounted /home as an EXT4 - This is used by Gitlab-CI to checkout the pre-reqs for each build.

## Performance (benchmarks)

### Observations

The HP P410i RAID card on the old G6 DL360's I am using for this is far underpowered and is unable to perform anywhere near the SSD's rated speeds.
Direct disk access is 2-6 times ‘faster' than XenServer's standard LVM or EXT3 storage.
There is less than a 10% difference in performance between the SSD RAID array on the VM with the presented disk than directly on the XenServer host.
XenServer's raw disk performance was exactly the same as Debian 7.
Remember to ensure your RAID (and disk cache if not in prod) is enabled!
Points of Note:

This is an old server, we're not talking your latest and greatest hardware here, we're talking giving new life to an old-ish dog so that it may retain its usefulness while remaining cost effective.
With TRIM being unavailable when using RAID, it is expected that the write performance will decrease somewhat overtime as the disks fill up as the disks will have to perform a ‘READ, ERASE, WRITE' rather than a simple WRITE, To aid the lack of TRIM, I have left more than 25% of the disks unused as we simply don't need 1TB of SSD storage on each of the hosts.
We have some 1GB cache cards arriving in the following weeks which we will upgrade to from the 512MB cards presently installed - I expect this to significantly further improve performance.

## Hardware

* Refurbished HP DL360 G6 (2010 model).
* 2x 8 Core Xeon x5550 w/ hyperthreading, 8 cores presented to domU.
* 96GB DDR3 in dom0, 4GB in domU.
* HP P410i w/ 512MB cache.
* 2x 10K 146GB spindles for dom0.
* ‘HP Genuine'!
* Constant 5-6 Watts each + cooling.
* 2x SanDisk Extreme Pro SSD 480GB in RAID 0
* SATA III, Read up to 550MB/s, Write up to 515MB/s, Random Read up to 100K IOPS, Random Write up to 90K IOPS.
* 0.15-0.2 Watts peak each.

EXT4 Bonnie++ Results w/ 2x SSD in RAID1, XenServer 6.5 RC1, LVM:

![]({{< ref "/" >}}/img/xenserver/dl360-lvm.jpg)

EXT4 Bonnie++ Results w/ 2x SSD in RAID1, XenServer 6.5 RC1, Direct Disk:

![]({{< ref "/" >}}/img/xenserver/dl360-dd.jpg)

EXT4 dd Results w/ 2x SSD in RAID0, XenServer 6.5 RC1, LVM:

```shell
samm@serv-dhcp-13:/var/tmp# dd if=/dev/zero of=tempfile bs=1M count=8000 conv=fdatasync,notrunc
 8000+0 records in
 8000+0 records out
 8388608000 bytes (8.4 GB) copied, 118.11 s, 71.0 MB/s
```

EXT4 dd Results w/ 2x SSD in RAID0, XenServer 6.5 RC1, Direct Disk:

```shell
samm@serv-dhcp-13:/var/tmp# dd if=/dev/zero of=tempfile bs=1M count=8000 conv=fdatasync,notrunc
 8000+0 records in
 8000+0 records out
 8388608000 bytes (8.4 GB) copied, 19.21 s, 437 MB/s
```

Future Benchmarking Steps

* Observe performance over time since TRIM is not available.
* Upgrade RAID cards to 1GB cache (we have some spares).
* Try with our new Gen8 BL460c blade servers, with locally attached P420i RAID controllers and 2GB cache.
* Try linux software RAID with direct disks.

## XenServer's Future

Filesystems

I would hope that both EXT4 (and BTRFS) support is added in the near future.
With this I would expect auto-detecting TRIM support similar to VMware and Hyper-V.
Direct Disk Access

Direct disk access clearly offers massive performance gains, I would like to see XenServer add this as an easy to use option when configuring storage.

Non-volatile advanced configuration

Related to direct disk access, XenServer needs some form of non-volatile advanced configuration options.
VMware, raw Xen and KVM let you tweak many options without risk of loss after installing minor updates.
