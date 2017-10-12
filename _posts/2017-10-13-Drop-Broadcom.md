---
title: Broadcom, Or How I Learned To Start Worrying And Drop The Packet
published: true
date: 2017-10-13
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-feetsky
---


Earlier this week we started the process to upgrade one of our hypervisor compute clusters and encountered a rather odd and painful bug with what turned out to be the Broadcom chipsets in the HP BL460c (Gen8) blades.

We first noticed problems after we were partially through a routine, rolling upgrade of our hypervisor (XenServer) cluster (pool) when we observed unexpected and intermittent loss of connectivity to several of the VMs, then hosts.

![](/img/office-space-broadcom.jpg)

What was a little odd (at first) was that the problems seemed to effect hosts that hadn’t yet been upgraded to XenServer 7.2 - we now attribute this to a symptom of extreme packet loss between the hosts in the pool and thanks to buggy firmware from Broadcom and HP.

We were aware of the [recently published issues](http://www.thevirtualist.org/bricked-qlogic-broadcom-bcm57840-driver-update/) with several Broadcom/HP NICs used in VMware clusters where NICs would be [bricked by a firmware upgrade](https://h20566.www2.hpe.com/hpsc/doc/public/display?docId=a00027033en_us). This issue is however slightly different from ours as it seemed to completely brick the NICs and it was suggested the problem was specific to VMware.

As mentioned above we ended up finding that there was extreme packet loss between hosts in the cluster, what made the problem worse is that as the master in a XenServer pool must be upgraded first - it meant that the communication problems with pool connectivity over the management network to the pool master impacted nodes that hadn’t yet been upgraded and the problems didn't manifest until many hours after the first host was upgraded and we were happy with it's stability - as such first appeared as if it was a problem caused by the pool being partially through an upgrade.

Appearing that the issue was stemming from having the pool partially upgraded, we felt like we had perhaps made a poor decision to run the upgrade on a single node for a few hours to observe it's performance and made the call to upgrade another host and then analyse our findings.

After upgrading the second host, it too appeared stable (in fact - this host wasn't impacted by the bug so it wasn't dropping packets and was healthy), with that we made the call to upgrade another two nodes and continue to monitor in the expectation that the problems with VM stability would recover as we continued the upgrade.

_That wasn't the case._

Shortly after upgrading approximately half the pool, things got far worse - hosts started completely dropping out of the pool, losing the state of VMs that it thought were powered on but in fact were offline and so forth.

While inspecting the hosts, we found that the master and one of the other hosts was indeed experiencing major packet loss on the network cards that connected to the internal management network, of course we immediately suspected faulty NICs (it wouldn't be the first time a Broadcom had dropped dead on us)

Broadcom has had it's fair share of bad press stemming from many botched firmware updates and issues with their proprietary drivers over the years and now I'm recommending people to stay clear form using network cards based on their chipsets.

## Downgrading The Firmware

As soon as we spotted the packet loss on the Broadcom NICs we downgraded the firmware from [2.19.22-1](http://downloads.linux.hpe.com/SDR/repo/spp/RHEL/7/x86_64/current/firmware-nic-qlogic-nx2-2.19.22-1.1.x86_64.rpm) to [2.18.44-1 / 7.14.62](http://downloads.linux.hpe.com/SDR/repo/spp/RHEL/7/x86_64/current/hp-firmware-nic-qlogic-nx2-2.18.44-1.1.x86_64.rpm) and even as old as [2.16.20 / 7.12.83](http://downloads.linux.hpe.com/SDR/repo/spp/RHEL/7/x86_64/current/hp-firmware-nic-qlogic-nx2-2.16.20-1.1.x86_64.rpm) from back in 2015.

No firmware downgrades (or upgrades) have fixed this issue.

The problem (major packet loss) manifests itself immediately after rebooting or power cycling - but not every time, that's the odd thing - approximately half the time after booting the host is fine - there are no problems until the next boot.

We've compared the `dmesg`, `lspci` and `modinfo` output between boot cycles where the problem exists and doesn't and we can't find anything that stands out so the bug seems to be triggered by the updated (but still old) version of the bnx2x driver present in XenServer 7.2's Kernel - HP recommends that you use bnx2x driver 7.14.29-2 or later and as XenServer still uses the old Kernel version of 4.4.0 - that's not an option.

We suspect that the issue is indeed a bug in the Broadcom firmware loaded into the NIC upon boot and there may be some sort of race condition or similar that causes this behaviour in combination with modern versions of the bnx2x drivers, perhaps related to the devices interupt handling.

## XenServer

Obviously XenServer needs to update it's kernel or at least it's bnx2x driver module, I'll be logging a ticket for this over at bugs.xenserver.org

Additionally, XenServer didn’t notice (or monitor) the packet loss / network interruptions and do anything to warn of the problem or even stop the rolling pool upgrade, I plan on reporting this concern and suggesting that XenServer adds pool wide checks for connectivity issues between hosts, at _least_ during a pool upgrade, I'll also be suggesting they issue an advisory regarding the Broadcom chipsets.

## BNX2X Driver

The driver included with XenServer 7.2 that triggers the problem is `1.714.1`:

{% highlight shell %}
filename:       /lib/modules/4.4.0+10/updates/bnx2x.ko
version:        1.714.1
license:        GPL
description:    QLogic BCM57710/57711/57711E/57712/57712_MF/57800/57800_MF/57810/57810_MF/57840/57840_MF Driver
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
{% endhighlight %}

Where as XenServer 7.0 has driver version `1.713.04` which seems not to trigger the issue:

{% highlight shell %}
filename:       /lib/modules/3.10.0+10/extra/bnx2x.ko
version:        1.713.04
license:        GPL
description:    QLogic BCM57710/57711/57711E/57712/57712_MF/57800/57800_MF/57810/57810_MF/57840/57840_MF Driver
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
{% endhighlight %}

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