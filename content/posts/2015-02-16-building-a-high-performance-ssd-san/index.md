---
author: "Sam McLeod"
toc: true
readingTime: true
categories: [ Tech ]
date: "2015-02-16T00:00:00Z"
aliases:
  - /tech/2015/02/16/building-a-high-performance-ssd-san/
  - /building-a-high-performance-ssd-san/
images: ["melbourne.jpg"]
featuredImagePreview: melbourne.jpg
series: [ Storage ]
tags:
- tech
- storage
- hardware
title: Building a high performance SSD SAN - Part 1
---

![]({{< ref "/" >}}/img/san/graphs.png)

Over the coming month I will be architecting, building and testing a modular, high performance SSD-only storage solution.

I'll be documenting my progress / findings along the way and open sourcing all the information as a public guide.

With recent price drops and durability improvements in solid state storage now is better time than any to ditch those old magnets.

Modular server manufacturers such as SuperMicro have spent large on R&D thanks to the ever growing requirements from cloud vendors that utilise their hardware.

## The State Of Enterprise Storage

Companies often settle for off-the-shelf large name storage products from companies based on several, often misguided assumptions:

* That enterprise in the product name = reliability
* That the blame from product / system failure can be outsourced
* That vendors provide specialist engineers to support such complicated (and expensive) products
* That that time and cost of building a modular storage solution tailored to their needs would be time consuming to design and manage

At the end of the day we don't trust vendors to design our servers - why would we trust them to design our storage?

A great quote on Wikipedia under 'enterprise storage':

*"You might think that the hardware inside a [SAN][1] is vastly superior to what can be found in your average server, but that is not the case. EMC (the market leader) and others have disclosed more than once that "the goal has always to been to use as much standard, commercial, off-the-shelf hardware as we can". So your SAN array is probably nothing more than a typical Xeon server built by Quanta with a shiny bezel. A decent professional 1 [TB][2] drive costs a few hundred dollars. Place that same drive inside a SAN appliance and suddenly the price per terabyte is multiplied by at least three, sometimes even 10! When it comes to pricing and [vendor lock-in][3] you can say that storage systems are still stuck in the "mainframe era" despite the use of cheap off-the-shelf hardware."*

It's the same old story, if you've got lots of money and you don't care about how you spend it or translating those savings onto your customers - sure *buy the ticket, take the ride* \- get a unit that comes with a flash logo, a 500 page brochure, licensing requirements and a greasy sales pitch.

## Our Needs

Storage performance always seems to be our bottleneck at Infoxchange, we run several high-performance high-concurrency applications with large databases and complex reporting.

We're grown (very) fast and with that spending too much on off-the-shelf storage solutions, we have a requirement to self-host most of our products securely within our own control, on our hardware and need to be flexible to meet current and emerging security requirements.

I have been working on various proof-of-concepts which have lead to our decision to proceed with our own modular storage system tailored to our requirements.

## Requirements

* Reliability above all else
  * SSD units must be durable
  * Network and iSCSI failover must be on-par with commercial products (if not better)
* Multiple levels of provable redundancy
  * RAID
  * Cross hardware-replication
  * Easy IP and iSCSI failover using standard tools
* 1RU rack hight per unit
* 100% SSD only - no spindles will be hurt in the making of this journey!
* Each unit to provide up to 450,000 IOP/s read performance on tier 1 storage
* Provide up to 2.5GB/s read performance and 1.5GB/s write performance on tier 1 storage
* Each unit to provide up to 400,000 IOP/s read performance on tier 2 storage
* Provide up to 1.2GB/s read performance and 1.2GB/s write performance on tier 2 storage
* 20Gbit of redundant network connectivity per unit
* Two tiers of SSD storage performance (PCIe & SATA)
* Easily monitorable with standard tools
* Use no proprietary RAID hardware
* Come with 3 years of hardware warranty cover
* Outperform all proprietary storage solutions costing twice the price or more
* Deployable and manageable by any sysadmin and require no specialised storage administrators
* Easily updatable for the latest security patches, features etc...
* Highly customisable and easily upgradable to larger / faster storage in the future
* Require significantly less energy and cooling over traditional storage units
* Offer at-rest encryption if required
* _**Cost less than $9.5K USD per node**_

## Software

|-|-|-|
|:-------------|:-------------|:-----|
| Operating System      | Debian | Debian is our OS of choice, it has newer packages than RedHat variants and is incredibly stable |
| RAID      | MDADM      |   For SSDs hardware RAID cards can often be their undoing - they simply can't keep up and quickly become the bottleneck in the system. MDADM is mature and very flexible |
| Node-to-Node Replication | DRBD      |
| NIC Bonding | LACP |
| IP Failover | Pacemaker | We'll probably also use a standard VM somewhere on our storage network for quorum |
| Monitoring | Nagios |
| Storage Presentation | Open-iSCSI |
| Kernel | Latest Stable (Currently 3.18.7) | Debian Backports currently has Kernel 3.16, however we do daily CI builds of the latest kernel stable source for certain servers and this may be a good use case for them due the SCSI bus bypass for NVMe introduced in 3.18+ |

We're going to start with a two node cluster, we want to keep rack usage to a minimum so I'm going to go with a high density 1RU build.

The servers themselves don't need to be particularly powerful which will help us keep the costs down. Easily the most expensive components are the 1.2TB PCIe SSDs - but the performance and durability of these units can't be overlooked, we're going to have a second performance tier constructed of high end SATA SSDs in RAID10. Of course if you wanted to reduce price further the PCIe SSDs could be left out or purchased at a later date.

## Hardware

|-|-|-|
|:-------------|:-------------|:-----|
|**Base Server** | SuperMicro SuperServer 1028R-WTNRT |2x 10GbE, NVMe Support, Dual PSU, Dual SATA DOM Support, 3x PCIe, 10x SAS/SATA HDD Bays |
| **CPU** | 2x Intel Xeon E5-2609 v3 | We shouldn't need a very high clock speed for our SAN, but it's worth getting the newer v3 processor range for the sake of future proofing. |
**RAM** |  32GB DDR4 2133Mhz | Again, we don't need that much RAM, however it will be used for disk caching but 32GB should be more than enough and can be easily upgraded at a later date. |
| **PCIe SSD** | 2x 1.2TB Intel SSD DC P3600 Series (With NVMe) | This is where the real money goes - the Intel DC P3600 and P3700 series really are top of the range, the critical thing to note is that they support NVMe which will greatly increase performance, they're backed by a 5 year warranty, these will be configured in RAID-1 for redundancy. |
| **SATA SSD** | 8x SanDisk Extreme Pro SSD 480GB | The SanDisk Extreme Pro line is arguably the most reliable and highest performing SATA SSD on the market - backed by a 10 year warranty, these will be configured in RAID-10 for redundancy and performance. |
| **OS SSD** | 2x 16GB MLC DOM | We don't need much space for the OS, just enough to keep vital logs and package updates, these will be configured in RAID-1 for redundancy.

![SuperMicro SuperServer 1028R-WTNRT]({{< ref "/" >}}/img/san/sm.jpg)
![SuperMicro SuperServer 1028R-WTNRT - mobo]({{< ref "/" >}}/img/san/mobo.jpg)
![1.2TB Intel SSD DC P3600 Series]({{< ref "/" >}}/img/san/intel.jpg)
![SuperMicro DOM]({{< ref "/" >}}/img/san/dom.jpg)
![SanDisk Extreme Pro SSD 480GB]({{< ref "/" >}}/img/san/ssd.jpg)

## AHCI vs NVMe

NVMe is a relatively new technology which I'm very interested in making use of for these storage units.

From [Wikipedia][4]:

*"NVM Express has been designed from the ground up, capitalizing on the low latency and parallelism of PCI Express SSDs, and mirroring the parallelism of contemporary CPUs, platforms and applications. By allowing parallelism levels offered by SSDs to be fully utilized by host's hardware and software, NVM Express brings various performance improvements."*

|-|AHCI|NVMe|
|:------------- |:-------------|:-----|
|Maximum queue depth |  1 command queue; 32 commands per queue | 65536 queues; 65536 commands per queue |
| Uncacheable register accesses (2000 cycles each) | 6 per non-queued command; 9 per queued command | 2 per command |
| MSI-X and interrupt steering |  single interrupt; no steering | 2048 MSI-X interrupts
| Parallelism and multiple threads | requires synchronization lock to issue a command | no locking |
| Efficiency for 4 KB commands | command parameters require two serialized host DRAM fetches | gets command parameters in one 64 Bytes fetch |

## NVMe and the Linux Kernel

*Intel published an NVM Express driver for Linux, It was merged into the Linux Kernel mainline on 19 March 2012, with the release of version 3.3 of the Linux kernel.*

*A scalable block layer for high-performance SSD storage, developed primarily by_ [_Fusion-io][5]_ _engineers, was merged into the Linux kernel mainline in kernel version 3.13, released on 19 January 2014. This leverages the performance offered by SSDs and NVM Express, by allowing much higher I/O submission rates. With this new design of the Linux kernel block layer, internal queues are split into two levels (per-CPU and hardware-submission queues), thus removing bottlenecks and allowing much higher levels of I/O parallelisation.*

Note the following: *As of version 3.18 of the Linux kernel, released on 7 December 2014,* [_VirtIO][6]_*block driver and the* [_SCSI][7]_*layer (which is used by Serial ATA drivers) have been modified to actually use this new interface; other drivers will be ported in the following releases.*

Debian - our operating system of choice currently has kernel 3.16 available (using the official backports mirrors), however we do generate CI builds of the latest stable kernel for specific platforms - if you're interested on how we're doing that I have some information [here][8].

That's where I'm upto for now, the hardware will hopefully arrive in two weeks and I'll begin the setup and testing.

### Coming soon

* Build experience / guide
* Monitoring
* Benchmarks
* Failover configuration and testing
* Software configurations (Including a Puppet module)
* Ongoing experiences and application

Stay tuned!

### Further reading

* [1-2 year SSD wear on build boxes has been minimal](https://news.ycombinator.com/item?id=9052925)
* From way back in 2011 - 'Velocity 2011: Artur Bergman - Artur on SSDs':

{{< youtube "H7PJ1oeEyGg" >}}

[1]: http://en.m.wikipedia.org/wiki/Storage_area_network "Storage area network"
[2]: http://en.m.wikipedia.org/wiki/Terabyte "Terabyte"
[3]: http://en.m.wikipedia.org/wiki/Vendor_lock-in "Vendor lock-in"
[4]: http://en.wikipedia.org/wiki/NVM_Express
[5]: http://en.wikipedia.org/wiki/Fusion-io
[6]: http://en.wikipedia.org/wiki/VirtIO
[7]: http://en.wikipedia.org/wiki/SCSI
[8]: http://smcleod.net/continuous-integration-for-the-linux-kernel-built-within-docker
