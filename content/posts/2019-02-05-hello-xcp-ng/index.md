---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2019-02-05T13:00:00Z"
aliases:
  - /tech/2019/02/11/hello-xcp-ng
image: xcpng_rocket_logo.png
featuredImagePreview: xcpng_rocket_logo.png
tags:
- tech
- software
title: Goodbye XenSever - Hello XCP-ng
---

In 2018 I set out to replace our XenSever 7.2 based virtualisation after [Citrix essentially screwed over free / open source users](https://xenserver.org/blog/entry/xenserver-7-3-changes-to-the-free-edition.html).

This project was to directly replace XenServer 7.2 with something supported and manageable for our traditional virtualisation needs.

---

## High Level Selection Considerations

I evaluated a number of options, with the primary candidates below.

Key criteria (at a high level) I was evaluating:

- Ease of moving from our existing XenServer 7.2 based hypervisor clusters.
- Security (architecture, hardening, monitoring, logging).
- Cost (both licensing if any and self-support / management costs).
- VM Performance (Storage IOPs and throughput, Network latency and throughput, Processing latency, steal from over-provisioned workloads).
- Management UI/UX and performance (for BAU activities).
- Management / Cluster SPOFs, fail-over and redundancy.
- Installation and upgrade process.
- Update and security patching frequency.
- Networking design and complexity.
- Community (size, engagement, acceptance of suggestions / MRs).
- Reliable live VM migrations.
- Ease of management for a small team (Part of a low TCO).
- Risk of vendor and technology lock-in.
- Risk of survival (will it still be well maintained over the next 1-3 years).
- Stability and reliability above practically all else.

## [XenServer 7.6 (w/ Paid License)](https://xenserver.org/)

### For

- Potentially priority support from Citrix for issues.
- Easy upgrade from 7.2.
- Fresh installs and upgrades are simple, painless and easy to pxeboot, licensing can be a pain after install however.

### Against

- Slow moving development.
- Incredibly expensive, [it would cost us something like $140,800 AUD per year (shelf price)](https://store.citrix.com/store/citrix/en_US/pd/ThemeID.37713000/productID.315979800) for our 32 hosts (each with 2 sockets).
- Features heavily restricted by licensing model.
- Mostly older-fashioned enterprise users.
- No web management interface (although you can use Xen Orchestra from the folks behind XCP-ng).
- Diminishing community since [XenServer licensing changes in 7.3](https://xenserver.org/blog/entry/xenserver-7-3-changes-to-the-free-edition.html).
- Poor storage performance compared to KVM based solutions.
- Many outdated packages, while kind of based on CentOS 7, there are a great deal of packages from older releases or completely custom rebuilt.
- Uses old technologies like EXT3 and doesn't support SSD/Flash TRIM/DISCARD functions.
- SELinux not enforcing or supported.
- OpenvSwitch still uses a lot of Dom0 CPU (same as XenServer).
- Dom0 often ends up limiting VM storage operations (tapdisk maxing out Dom0 CPU).
- Applying updates can be painful or at least slow, requiring binary ISO files to be downloaded from Citrix.
- Uses Jira for bug tracking (I just can't stand the thing, it's painfully laggy, give my GitLab or Github over it any day).

## [XCP-ng](https://xcp-ng.org/)

XCP-ng is a relatively recent fork from XenServer after it was open sourced, tracking upstream but clearly prioritising modernisation and community.

- [XCP-ng: Building an Open Source and Turnkey virtualisation platform - Talk/Video FOSDEM](https://www.youtube.com/watch?v=VpGC5zuLjSs)

### For

- Simple and painless upgrade from XenServer 7.2.
- Fresh installs and upgrades are simple, painless and easy to pxeboot.
- Updates are very easy and all provided via yum.
- Rapidly growing and inclusive community.
- Much more modern and easy to use [forums](https://xcp-ng.org/forum/).
- Open source and without licensing to worry about or restrictions on features.
- Live VM migrations are not only faster, but I am yet to have a VM fail to migrate.
- CentOS 7 based, and while still has many old packages (from XenServer) the developers and community are working hard to modernise these.
- Much easier to submit bugs and MRs via their public repos than XenServer.
- A fantastic level of transparency of direction and challenges.
- You have the option of using [Xen Orchestra](https://xen-orchestra.com) has a web interface to manage XCP-ng.
- mdadm, kernel (some say 'software') RAID support.
- Promising support for OpenZFS.
- Prioritising replacing old technologies built into XenServer, such as [moving from EXT3 to EXT4](https://xcp-ng.org/forum/topic/839/new-ext4-driver-please-test-it) and working on a more modern kernel build pipeline.
- TRIM/DISCARD for iSCSI LUNs is [in the works](https://github.com/xcp-ng/xcp/issues/123).
- Efficient ZSTD import/export compression.
- The start of an exciting [Roadmap](https://github.com/xcp-ng/xcp/wiki/Roadmap).
- (Near future) enhancements for a new storage stack (SMAPIv3).
- (Near future) enhancement to include VXLAN support.
- Significant [initiative into research and development](https://xcp-ng.org/blog/2018/12/19/xcp-ng-research-initiative/), partnering with several educational and scientific institutions.
- [And lots of other enhancements being worked on and in the backlog](https://github.com/xcp-ng/xcp/issues?q=is%3Aopen+is%3Aissue+label%3A%22enhancement+%3Anew%3A%22).

### Against

- Poor storage performance compared to KVM based solutions (same as XenServer).
- SELinux not enforcing or supported (same as XenServer).
- OpenvSwitch still uses a lot of Dom0 CPU (same as XenServer).
- Dom0 often ends up limiting VM storage operations (tapdisk maxing out Dom0 CPU) (same as XenServer).

## [oVirt](https://www.ovirt.org/)

_Note: I found myself in a bit of a love/hate relationship with oVirt, while it's performance and architecture was quite impressive,
there were just too many problems with it's install and upgrade process for me to really 'trust' it for us.
I do expect this to improve in the future, the community is very active and the product is moving quickly._

### For

- Solid technology that's the upstream for Redhat's RHEV.
- Redhat backed.
- Fantastic KVM performance that far outweighs _any_ Xen based distribution I've tested.
- Decent web-based HTML5 management interface, could do with some UX but is constantly improving.
- Best security model of the hypervisor distros I tested, SELinux enforced on, clear hardening and best practise shows in configuration files and defaults.

### Against

- Messy, complex networking configuration.
- Very complex and often unpredictable installation that often seems to fail on repeated identical installations.
- Management is a floating VM which _could_ be considered a SPOF.
- Very long, slow install process.
- Complex multi-step upgrade / update process.
- Live VM migrations have been a mixed bag with VMs randomly failing to migrate and ending up switched off but working perfectly at other times.
- Could be a very time consuming migration from XenServer, but this goes for any Xen->KVM migrations (despite the various conversion tools available that I tried).

## [Proxmox](https://www.proxmox.com/en/)

_Note: While Proxmox might be OK for a small deployment or home lab, I'd probably rather just run something like CentOS/Fedora with KVM and [Kimchi](https://github.com/kimchi-project/kimchi) for management._

### For

- Fantastic KVM performance that far outweighs _any_ Xen based distribution I've tested.
- Easy install and upgrade (simply through apt).
- Decent web interface for management, although lacking many options that must be set on the command line leading to some configuration confusion.

### Against

- Design seems to be lacking some general security / hardening awareness.
- SELinux not just set to permissive - but completely uninstalled.
- Had a very 'home lab' feel to it's architecture, configuration management and community.
- Still required paid subscription for (some) updates.
- Due to the odd way Proxmox handles it's configuration, it was going to be hard to decide what should be Puppet controlled and what shouldn't.
- Networking configuration is more complex to manage, partly due to some limitations with the web based management interface.

---

## Decision time

As much as I would have liked to shift to a KVM based solution, I just didn't feel that oVirt was a safe move for a small team.

Staying and paying for XenServer seemed insane and I do not believe that the Citrix XenServer project will live on for long other than in large locked-in organisations.

Given that we wanted a simple upgrade process to something that was maintained and had a good community XCP-ng ended up being the (almost) obvious choice.

### Upgrade experience

The upgrade from XenServer 7.2 to XCP-ng 7.6 couldn't have been more easy.

1. Insert XCP-ng ISO (pool master first).
2. Select Upgrade.
3. Repeat.
4. Switch to using XCP-ng Centre rather than XenCentre

Of course there is a lot we manage with automation (Puppet), so I had to make some minor updates to our Puppet manifests but that happened as XenServer major releases came out regardless.

#### Upgrade bugs

We only hit two _minor_ problems during the upgrade, thankfully I was warned about one and the other was an easy fix:

1. A [bug in the upstream XenServer](https://bugs.xenserver.org/browse/XSO-924) which meant I had to ensure the vm parameter `platform:device_id` was set to `0001` on all VMs, otherwise they'd fail to live migrate during a pool upgrade, I did this simply ensuring it was set across all VMs before the upgrade:

```
xe vm-param-set platform:device_id=0001 uuid=b56f95fb-cb8f-86ce-5c7d-8efc2239f1db
```

2. After upgrading from XenServer 7.2 to XCP-ng 7.6 hosts lost their iSCSI IQN shortly after their first boot.

I simply grabbed their correct IQN from our [storage servers](https://smcleod.net/tech/2015/06/17/ssd-storage-cluster-diagram.html) config (in [hiera](https://wikitech.wikimedia.org/wiki/Puppet_Hiera))
and set it in XCP-ng centre for each host after they were upgraded.

---

## Three weeks with XCP-ng

Over the past 2-4 weeks I've upgraded two clusters with a total of 32 physical hosts and 240~ VMs from XenServer 7.2 to XCP-ng 7.6.

Obviously while the XCP-ng upgrade itself is an easy process there was a _lot_ of prior testing, peer review and then the hundreds of VMs to live migrate and juggle for clustered systems, but - it went well with no impact to our internal business services or customers.

So far, compared to XenServer, XCP-ng has been painless and the transition was easy for both myself and the team that uses it daily.

We have encountered no problems at all and both the product shows real progress and promise while the community has been active and supportive.

---

# The Future (For us)

This project was to directly replace XenServer 7.2 with something supported and manageable for our traditional virtualisation needs.

It's worth mentioning that in longer term we will likely move to a mixed virtual environment.

This will likely involve container host nodes being directly controlled / orchestrated by Kubernetes
and some traditional hypervisor clusters (perhaps XCP-ng!) for traditional VM suited / stateful workloads.

---

## XCP-ng Links

- [XCP-ng Website](https://xcp-ng.org/)
- [XCP-ng Blog](https://xcp-ng.org/blog/)
- [XCP-ng Roadmap](https://github.com/xcp-ng/xcp/wiki/Roadmap)
- [XCP-ng Download](https://xcp-ng.org/#easy-to-install)
- [XCP-ng Centre Downloads](https://github.com/xcp-ng/xenadmin/releases)
- [XCP-ng Twitter](https://twitter.com/xcpng)
- [Xen Orchestra](https://xen-orchestra.com)

Getting help:

- [XCP-ng Forums](https://xcp-ng.org/forum/)
- [XCP-ng IRC](irc://irc.freenode.net/#xcp-ng)
- [XCP-ng GitHub Issues](https://github.com/xcp-ng/xcp/issues)
