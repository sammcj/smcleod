---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-07-07T00:00:00Z"
aliases:
  - /tech/2015/07/07/centos-7-and-ha/
image: billy-huynh-278252.jpg
featuredImagePreview: billy-huynh-278252.jpg
tags:
- tech
- storage
- clustering
title: CentOS 7 and HA
---

First some background...

One of the many lessons I've learnt from my Linux HA / Storage clustering project is that the Debian HA ecosystem is essentially broken, We reached the point where packages were too old, too buggy or in Debian 8's case - outright missing.

In the past I was very disappointed with RHEL/CentOS 5 / 6 and (until now) have been quite satisfied with Debian as a stable server distribution with historicity more modern packages and kernels.

**_I feel that CentOS / RHEL 7 has changed the game.*_**

(When combined with ElRepo or EPEL that provide wide array of modern packages)

It is simply light years ahead of it's predecessor, resolves a lot of the issues we've had with Debian Jessie and after thorough testing of Debian 7,8 Centos 6,7 I have decided to employ CentOS 7 as the base OS for the storage cluster.
CentOS / RHEL 7 are missing a few critical packages in the cluster HA space

1. The available pacemaker package was built without `--with-stonith`.
This means there is no support for legacy STONITH plugins, many of these are heavily relied upon and do not have replacements in the new plugin system.

2. `cluster-glue` is missing / has been deprecated.
The cluster-glue package provides a lot of very useful resource agents / plugins which again, are missing from the new pacemaker builds.

3. `crmsh` is no longer available and has been replaced by `pcs`.
pcs is great, but lots of very useful tools still use crmsh including the [puppet-corosync](https://github.com/puppet-community/puppet-corosync) module which is fantastic for bootstrapping clusters.

## Short term solution

### Pacemaker

I have recompiled CentOS 7's pacemaker package changing only one thing - I added `--with-stonith` to the rpmbuild command.

- This is available from my [packagecloud repo](https://packagecloud.io/s_mcleod/pacemaker).

### Cluster-Glue

OpenSUSE provides the `cluster-glue` and `cluster-glue-libs` from their [CentOS 7 repository](http://download.opensuse.org/repositories/network:/ha-clustering:/Stable/CentOS_CentOS-7/)

- This is also available from my [packagecloud repo](https://packagecloud.io/s_mcleod/pacemaker).

### CRMSH

OpenSUSE also provides `crmsh` from their [CentOS 7 repository]((<http://download.opensuse.org/repositories/network:/ha-clustering:/Stable/CentOS_CentOS-7/>)

- This is also available from my [packagecloud repo](https://packagecloud.io/s_mcleod/pacemaker).

## Long term solution

### Update STONITH / Fencing agents

Obviously the best solution however have a feeling that it will take some time for all the maintainers of the existing STONITH / fencing agent developers to port their code to the new framework.

### Request package to be built --with stonithd

- [RedHat BugZilla](https://bugzilla.redhat.com/show_bug.cgi?id=1240868)

### Host required packages

I have been logging requests to various third party RHEL repos asking if they would the missing packages.

- [GhettoForge](http://ghettoforge.org/index.php/Usage) are currently considering hosting `pacemaker` built `--with stonithd` in their gf-plus repo.
- [RPMFusion](http://rpmfusion.org/Wishlist?action=diff&rev1=401&rev2=402)
- [ELRepo](http://elrepo.org/bugs/view.php?id=579)

If they don't feel they have the resources or want to add them in for whatever reason, I will continue to host the packages myself on [Packagecloud](https://packagecloud.io/s_mcleod/pacemaker) and likely somewhere else as a fall-back.

```
Last updated: Tue Jul  7 11:59:25 2015
Last change: Tue Jul  7 10:57:16 2015
Stack: corosync
Current DC: s1-san5 (1) - partition with quorum
Version: 1.1.12-a14efad
2 Nodes configured
16 Resources configured


Online: [ s1-san5 s1-san6 ]

 Clone Set: ping_gateway-clone [ping_gateway]
     Started: [ s1-san5 s1-san6 ]
 Master/Slave Set: ms_drbd_r0 [drbd_r0]
     Masters: [ s1-san5 ]
     Slaves: [ s1-san6 ]
 ip_r0  (ocf::heartbeat:IPaddr2): Started s1-san5
 iscsi_target_r0  (ocf::heartbeat:iSCSITarget): Started s1-san5
 iscsi_lun_r0 (ocf::heartbeat:iSCSILogicalUnit):  Started s1-san5
 stonith_s1-san5  (stonith:rcd_serial): Started s1-san6
 stonith_s1-san6  (stonith:rcd_serial): Started s1-san5
 Master/Slave Set: ms_drbd_r1 [drbd_r1]
     Masters: [ s1-san5 ]
     Slaves: [ s1-san6 ]
 ip_r1  (ocf::heartbeat:IPaddr2): Started s1-san5
 iscsi_target_r1  (ocf::heartbeat:iSCSITarget): Started s1-san5
 iscsi_lun_r1 (ocf::heartbeat:iSCSILogicalUnit):  Started s1-san5
 iscsi_conf_r1  (ocf::heartbeat:anything):  Started s1-san5
 iscsi_conf_r0  (ocf::heartbeat:anything):  Started s1-san5
```
