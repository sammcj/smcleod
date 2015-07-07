---
title: CentOS 7 and HA
categories: []
published: True
---

First some background...

One of the many lessons I've learnt from my Linux HA / Storage clustering project is that the Debian HA ecosystem is essentially broken, We reached the point where packages were too old, too buggy or in Debian 8s case - outright missing.
I was very disappointed with RHEL/CentOS 5 / 6 and until now was quite satisfied with Debian as a stable, yet more modern server distribution.

I feel that CentOS 7 however is light years ahead of it's predecessor and after thorough testing I have decided to employ it as the base OS for the storage cluster.
I'm planning on writing a post explaining my experiences with Debian vs CentOS in the HA space in the very near future.

CentOS / RHEL 7 are missing a few critical packages in the cluster HA space.

1. The available pacemaker package was built without `--with-stonith`.
This means there is no support for legacy STONITH plugins, many of these are heavily relied upon and do not have replacements in the new plugin system.

2. `cluster-glue` is missing / has been deprecated.
The cluster-glue package provides a lot of very useful resource agents / plugins which again, are missing from the new pacemaker builds.

3. `crmsh` is no longer available and has been replaced by `pcs`.
pcs is great, but lots of very useful tools still use crmsh including the [puppet-corosync](https://github.com/puppet-community/puppet-corosync) module which is fantastic for bootstrapping clusters.


## Short term solution:

### Pacemaker
I have recompiled CentOS 7's pacemaker package changing only one thing - I added `--with-stonith` to the rpmbuild command.

- This is available from my [packagecloud repo](https://packagecloud.io/mrmondo/pacemaker).

### Cluster-Glue
OpenSUSE provides the cluster-glue and cluster-glue-libs [packages](ftp://rpmfind.net/linux/opensuse/factory/repo/oss/suse/x86_64/cluster-glue-1.0.12-19.2.x86_64.rpm)

- This is also available from my [packagecloud repo](https://packagecloud.io/mrmondo/pacemaker).

### CRMSH
OpenSUSE factory provides the crmsh [package](ftp://195.220.108.108/linux/opensuse/factory/repo/oss/suse/noarch/crmsh-2.2.0~rc3+git.1435265407.2865580-1.1.noarch.rpm)

- This is also available from my [packagecloud repo](https://packagecloud.io/mrmondo/pacemaker).

## Long term solution:

### Update STONITH / Fencing agents

Obviously the best solution however have a feeling that it will take some time for all the maintainers of the existing STONITH / fencing agent developers to port their code to the new framework.

### Host required packages

I have logged a feature request with the kind folks at ElRepo requesting that they add the missing packages into ElRepo.
If they don't feel they have the resources or want to add them in for whatever reason, I will continue to host the packages myself on [Packagecloud](https://packagecloud.io/mrmondo/pacemaker) and likely somewhere else as a fall-back.

- [Link to the ElRepo request](http://elrepo.org/bugs/view.php?id=579)


{% highlight bash %}
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
{% endhighlight %}
