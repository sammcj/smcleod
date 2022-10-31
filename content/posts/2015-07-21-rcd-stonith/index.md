---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-07-21T00:00:00Z"
aliases:
  - /tech/2015/07/21/rcd-stonith/
image: padlock.jpg
featuredImagePreview: padlock.jpg
tags:
- tech
- storage
- hardware
title: Delayed Serial STONITH
---

A modified version of [John Sutton's](http://www.scl.co.uk/rcd_serial/README.rcd_serial) rcd_serial cable coupled with our Supermicro reset switch hijacker:

![]({{< ref "/" >}}/img/san/rcd_serial.jpg)

This works with the rcd_serial fence agent [plugin](https://github.com/ClusterLabs/fence-agents/tree/master/agents/rcd_serial).

Reasons `rcd_serial` makes for a very good [STONITH](https://en.wikipedia.org/wiki/STONITH) mechanism:

- It has no dependency on power state.
- It has no dependency on network state.
- It has no dependency on node operational state.
- It has no dependency on external hardware.
- It costs less that $5 + time to build.
- It is incredibly simple and reliable.

Essentially the most common STONITH agent type in use is probably those that control UPS / PDUs, while this sounds like a good idea in theory there are a number of issues with relying on a UPS / PDU:

- Units that have remote power control over individual outlets are very expensive and if an upgrade is undertaken a rake-wide outage may be required depending on the existing infrastructure.
- Often these units are managed via the network, requiring the network and all that that entails to be functioning as expected. It also may require an additional NIC that may or may not fit into your storage units.
- There are almost always two PDUs / UPSs to manage, until very recently the PDU STONITH agents only supported sending an action to a single unit, while they now support sending them to two units in modern packages there a number of situations that are complex to manage and predict - i.e. what if one unit responds, cuts the power and the other doesn't? Who's in charge? Do we fail over? etc... that's a LOT of logic for a STONITH action.
- I've seen several PDUs fail, it's not pretty and often the management interface is the first thing to go.

---

{{< admonition info >}}
The following was v1 of the devices design, a post on the update v2/v3 design can be found [here](https://smcleod.net/tech/2016/07/04/update-rcd-stonith-design.html)
{{< /admonition >}}

[Adam Coy's](https://www.linkedin.com/pub/adam-coy/5/989/888) slightly modified version of the circuit that includes an indicator LED and an [optocoupler](https://en.wikipedia.org/wiki/Opto-isolator):

![]({{< ref "/" >}}/img/san/optoCircuit.jpg)

Example of where our Supermicro reset hijack connects on the target node:

![]({{< ref "/" >}}/img/san/reboot_jumper.jpg)

Image of the rear of a two node cluster with networking and rcd_serial STONITH (v1) connectors attached:

![]({{< ref "/" >}}/img/san/storage_with_stonith_rear.jpg)

---

### Availability

{{< admonition info >}}
This has since been added to RHEL/CentOS and the official Clusterlabs resource agents
{{< /admonition >}}

aliases:

-

At present the rcd_serial STONITH agent is available as part of the [`cluster-glue`](https://packagecloud.io/s_mcleod/pacemaker/packages/el/7/cluster-glue-1.0.12-1.16.1.x86_64.rpm) package, `cluster-glue` is not available in RHEL/CentOS but can be obtained from [OpenSUSE's CentOS7 Repo](ftp://rpmfind.net/linux/opensuse/factory/repo/oss/suse/x86_64/cluster-glue-1.0.12-19.2.x86_64.rpm) or [my own mirror](https://packagecloud.io/s_mcleod/pacemaker). (Tested with CentOS 7).

I have an open ticket with [RedHat](https://bugzilla.redhat.com/show_bug.cgi?id=1240868) regarding the fact that their pacemaker rpm is built without the `--with stonithd` flag which allows this to work without with their version of Pacemaker.

The long term solution is to get `rcd_serial` migrated to the new Pacemaker agent [API](https://fedorahosted.org/cluster/wiki/FenceAgentAPI) ([or is it this one?](http://clusterlabs.org/doxygen/pacemaker/2927a0f9f25610c331b6a137c846fec27032c9ea/stonith-ng_8h.html)) system.
