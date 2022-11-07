---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2017-10-13T00:00:00Z"
aliases:
  - /tech/2017/10/13/Drop-Broadcom
images: ["office-space-broadcom.jpg"]
featuredImagePreview: office-space-broadcom.jpg
tags:
- tech
- networking
- hardware
title: Broadcom, Or How I Learned To Start Worrying And Drop The Packet
---

Earlier this week we started the process to upgrade one of our hypervisor compute clusters when we encountered a rather painful bug with HP's Broadcom NIC chipsets.

We were part way through a routine rolling pool upgrade of our hypervisor (XenServer) cluster when we observed unexpected and intermittent loss of connectivity between several VMs, then entire XenServer hosts.

The problems appeared to impact hosts that hadn't yet upgraded to XenServer 7.2. We now attribute this to a symptom of extreme packet loss between the hosts in the pool and thanks to buggy firmware from Broadcom and HP.

We were aware of the [recently published issues](http://www.thevirtualist.org/bricked-qlogic-broadcom-bcm57840-driver-update/) with Broadcom/HP NICs used in VMware clusters where NICs would be [bricked by a firmware upgrade](https://h20566.www2.hpe.com/hpsc/doc/public/display?docId=a00027033en_us). This issue is different from what we experienced.

We experienced extreme packet loss between hosts in the cluster. With XenServer, the pool master must be upgraded first. The result was that XAPI pool management suffered a communication breakdown across the management network and complicated diagnosis. In fact, the connectivity problems went unnoticed until many hours after the master was upgraded.

At first appeared as if it was a problem caused by the pool being partially upgraded.

We wondered if we had perhaps made a poor decision to run the upgrade on a single node for a few hours to observe its performance. We made the call to upgrade another host and analyse our findings.

The next upgraded hosts appeared stable. In fact we later found this host wasn't impacted by the bug. We then made the call to upgrade several more nodes and continue to track their stability.

After upgrading half the pool, we suddenly hit problems. VMs failed, Hosts started dropping out of the pool and losing track of the power state of running/stopped VMs.

We found that the master along with one of the other hosts were experiencing major packet loss on their management network cards. We suspected faulty NICs as it wouldn't be the first time a Broadcom had failed us and there is no physical network cabling.

Broadcom has had its fair share of bad press over the years. Many botched firmware updates and proprietary driver issues. I'm recommending people to stay clear from using network cards based on their chipsets.

## Downgrading The Firmware

As soon as we spotted the packet loss on the Broadcom NICs we upgraded their firmware to [2.19.22-1](http://downloads.linux.hpe.com/SDR/repo/spp/RHEL/7/x86_64/current/firmware-nic-qlogic-nx2-2.19.22-1.1.x86_64.rpm) with no improvement.
We then upgraded to [2.18.44-1 / 7.14.62](http://downloads.linux.hpe.com/SDR/repo/spp/RHEL/7/x86_64/current/hp-firmware-nic-qlogic-nx2-2.18.44-1.1.x86_64.rpm) again with no improvement.
We even went as far as trying [2.16.20 / 7.12.83](http://downloads.linux.hpe.com/SDR/repo/spp/RHEL/7/x86_64/current/hp-firmware-nic-qlogic-nx2-2.16.20-1.1.x86_64.rpm) from back in 2015 - but still no luck.

At the time of writing this no firmware downgrades (or upgrades) have fixed the issue.

The packet loss manifests itself immediately after rebooting or power cycling. But - _not on every reboot!_. This is the odd thing - approximately half the time when booting a host it is fine until the next boot.

We've compared the `dmesg`, `lspci` and `modinfo` output between boot cycles, we can't find anything that stands out.

The bug seems to be caused by the version of the `bnx2x` driver present in XenServer 7.2's Kernel. Upon further reading HP recommends that you use bnx2x driver 7.14.29-2 or later, XenServer still uses the old Kernel version of 4.4.0 - that's not currently an option.

I suspect that it's a bug in the Broadcom firmware loaded into the NIC upon boot.
I suspect a race condition related to the devices interrupt handling (MSI/MSI-X).

## XenServer

XenServer needs to update its kernel or at least the bnx2x driver module past the version that triggers the bug. I've logged a ticket for this over at [bugs.xenserver.org](https://bugs.xenserver.org/browse/XSO-808)

Additionally, XenServer didn't notice the packet loss/network interruptions during the rolling pool upgrade. I have reported this concern and have suggested that XenServer adds pool wide checks for connectivity issues between hosts, at _least_ during a pool upgrade.

## Workaround

We don't have (a good) one.

Currently we're simply testing for packet loss after boot on the management NIC. If detected we reboot the host and check again. This far from ideal - but until the bug is resolved there isn't any other fix that we can find short of compiling a custom module for XenServer 7.2.

Given the widespread problems with Broadcom, we've ordered HP 560M, Intel based NICs to replace them.

## BNX2X Driver

The driver included with XenServer 7.2 that triggers the problem is `1.714.1`:

```
filename:       /lib/modules/4.4.0+10/updates/bnx2x.ko
version:        1.714.1
license:        GPL
#description:   QLogic BCM57710/57711/57711E/57712/57712_MF/57800/57800_MF/57810/57810_MF/57840/57840_MF Driver
author:         Eliezer Tamir
srcversion:     927337210F53311B18D0D7E
alias:          pci:v000014E4d0000163Fsv*sd*bc*sc*i*
alias:          pci:v000014E4d0000163Esv*sd*bc*sc*i*
alias:          pci:v000014E4d0000163Dsv*sd*bc*sc*i*
alias:          pci:v00001077d000016ADsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016ADsv*sd*bc*sc*i*
alias:          pci:v00001077d000016A4sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A4sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016ABsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016AFsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A2sv*sd*bc*sc*i*
alias:          pci:v00001077d000016A1sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A1sv*sd*bc*sc*i*
alias:          pci:v000014E4d0000168Dsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016AEsv*sd*bc*sc*i*
alias:          pci:v000014E4d0000168Esv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A9sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A5sv*sd*bc*sc*i*
alias:          pci:v000014E4d0000168Asv*sd*bc*sc*i*
alias:          pci:v000014E4d0000166Fsv*sd*bc*sc*i*
alias:          pci:v000014E4d00001663sv*sd*bc*sc*i*
alias:          pci:v000014E4d00001662sv*sd*bc*sc*i*
alias:          pci:v000014E4d00001650sv*sd*bc*sc*i*
alias:          pci:v000014E4d0000164Fsv*sd*bc*sc*i*
alias:          pci:v000014E4d0000164Esv*sd*bc*sc*i*
depends:        mdio,libcrc32c,ptp,vxlan
vermagic:       4.4.0+10 SMP mod_unload modversions
parm:           pri_map: Priority to HW queue mapping (uint)
parm:           num_queues: Set number of queues (default is as a number of CPUs) (int)
parm:           disable_iscsi_ooo: Disable iSCSI OOO support (uint)
parm:           disable_tpa: Disable the TPA (LRO) feature (uint)
parm:           int_mode: Force interrupt mode other than MSI-X (1 INT#x; 2 MSI) (uint)
parm:           dropless_fc: Pause on exhausted host ring (uint)
parm:           poll: Use polling (for debug) (uint)
parm:           mrrs: Force Max Read Req Size (0..3) (for debug) (int)
parm:           debug: Default debug msglevel (uint)
parm:           num_vfs: Number of supported virtual functions (0 means SR-IOV is disabled) (uint)
parm:           autogreeen: Set autoGrEEEn (0:HW default; 1:force on; 2:force off) (uint)
parm:           native_eee:int
parm:           eee:set EEE Tx LPI timer with this value; 0: HW default; -1: Force disable EEE.
parm:           tx_switching: Enable tx-switching (uint)
```

Whereas XenServer 7.0 has driver version `1.713.04` which seems not to trigger the issue:

```
filename:       /lib/modules/3.10.0+10/extra/bnx2x.ko
version:        1.713.04
license:        GPL
#description:   QLogic BCM57710/57711/57711E/57712/57712_MF/57800/57800_MF/57810/57810_MF/57840/57840_MF Driver
author:         Eliezer Tamir
srcversion:     13EAA521200A40118055D63
alias:          pci:v000014E4d0000163Fsv*sd*bc*sc*i*
alias:          pci:v000014E4d0000163Esv*sd*bc*sc*i*
alias:          pci:v000014E4d0000163Dsv*sd*bc*sc*i*
alias:          pci:v00001077d000016ADsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016ADsv*sd*bc*sc*i*
alias:          pci:v00001077d000016A4sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A4sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016ABsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016AFsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A2sv*sd*bc*sc*i*
alias:          pci:v00001077d000016A1sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A1sv*sd*bc*sc*i*
alias:          pci:v000014E4d0000168Dsv*sd*bc*sc*i*
alias:          pci:v000014E4d000016AEsv*sd*bc*sc*i*
alias:          pci:v000014E4d0000168Esv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A9sv*sd*bc*sc*i*
alias:          pci:v000014E4d000016A5sv*sd*bc*sc*i*
alias:          pci:v000014E4d0000168Asv*sd*bc*sc*i*
alias:          pci:v000014E4d0000166Fsv*sd*bc*sc*i*
alias:          pci:v000014E4d00001663sv*sd*bc*sc*i*
alias:          pci:v000014E4d00001662sv*sd*bc*sc*i*
alias:          pci:v000014E4d00001650sv*sd*bc*sc*i*
alias:          pci:v000014E4d0000164Fsv*sd*bc*sc*i*
alias:          pci:v000014E4d0000164Esv*sd*bc*sc*i*
depends:        mdio,libcrc32c,ptp
vermagic:       3.10.0+10 SMP mod_unload modversions
parm:           pri_map: Priority to HW queue mapping (uint)
parm:           num_queues: Set number of queues (default is as a number of CPUs) (int)
parm:           disable_iscsi_ooo: Disable iSCSI OOO support (uint)
parm:           disable_tpa: Disable the TPA (LRO) feature (uint)
parm:           int_mode: Force interrupt mode other than MSI-X (1 INT#x; 2 MSI) (uint)
parm:           dropless_fc: Pause on exhausted host ring (uint)
parm:           poll: Use polling (for debug) (uint)
parm:           mrrs: Force Max Read Req Size (0..3) (for debug) (int)
parm:           debug: Default debug msglevel (uint)
parm:           num_vfs: Number of supported virtual functions (0 means SR-IOV is disabled) (uint)
parm:           autogreeen: Set autoGrEEEn (0:HW default; 1:force on; 2:force off) (uint)
parm:           native_eee:int
parm:           eee:set EEE Tx LPI timer with this value; 0: HW default; -1: Force disable EEE.
parm:           tx_switching: Enable tx-switching (uint)
```

## Affected Components

* [HP 530M Network cards](https://www.hpe.com/h20195/v2/getpdf.aspx/c04111538.pdf?ver=3) (as they use the Broadcom bcm57810 chipset), commonly found in BL460c Gen8 blades and similar.
* XenServer 7.2 (Patched to the latest XS72E006 patch)
* Kernel 4.4.0+10 as found in XenServer 7.2
* Broadcom bnx2x module version 1.714.1
* [HP firmware for qlogic nx2](http://h20564.www2.hpe.com/hpsc/swd/public/detail?swItemId=MTX_3bc2b88453424d87b7543d6459) (seemingly all versions)

## Links

* [Broadcom, Die Mutha](http://blog.serverfault.com/post/broadcom-die-mutha/)
* [Bricked QLogic Broadcom BCM57840 after driver update](http://www.thevirtualist.org/bricked-qlogic-broadcom-bcm57840-driver-update/)
* [HP Flex-10 10Gb 2-port 530M Adapter](https://www.hpe.com/h20195/v2/getpdf.aspx/c04111538.pdf?ver=3)
* [HPE Network Adapters - Updating The BNX2X Driver Package Version 2.713.30 On VMware Hosts With Certain Network Adapters Running Certain Firmware May Require A Network Adapter Replacement](https://h20566.www2.hpe.com/hpsc/doc/public/display?docId=a00027033en_us)
* [HP Qlogic NX2 Firmware](http://h20564.www2.hpe.com/hpsc/swd/public/detail?swItemId=MTX_19bc1fb428d4400a90d59a7175#tab-history)
