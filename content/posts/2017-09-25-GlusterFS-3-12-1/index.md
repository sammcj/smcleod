---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2017-09-25T00:00:00Z"
aliases:
  - /tech/2017/09/25/GlusterFS-3-12-1
image: backdrop-insidebuilding.jpg
featuredImagePreview: backdrop-insidebuilding.jpg
tags:
- tech
- storage
- software
title: GlusterFS
---

We're in the process of shifting from using our custom 'glue' for orchestrating Docker deployments to Kubernetes, When we first deployed Docker to replace LXC and our legacy Puppet-heavy application configuration and deployment systems there really wasn't any existing tool to manage this, thus we rolled our own, mainly a few Ruby scripts combined with a Puppet / Hiera / Mcollective driven workflow.

The main objective is to replace our legacy NFS file servers used to host uploads / attachments and static files for our web applications, while NFS(v4) performance is adequate, it is a clear single point of failure and of course, there are the age old stale mount problems should network interruptions occur.

I spent time evaluating various cluster filesystems / network block storage and the two that stood out were Ceph and Gluster and settled on Gluster as the most suitable for our needs, it's far less complex to deploy than Ceph, it has less moving pieces and files are stored in a familiar manner on hosts.

## Implementation

I've settled on a 3 node deployment with one node as an [arbiter](http://docs.gluster.org/en/latest/Administrator%20Guide/arbiter-volumes-and-quorum/) (replica 3, arbiter 1).

Our nodes are CentOS 7 VMs within our exiting XenServer infrastructure, each node has 8 vCPUs [Xeon E5-2680 v4](https://ark.intel.com/products/91754/Intel-Xeon-Processor-E5-2680-v4-35M-Cache-2_40-GHz), 16GB of RAM and backed by our [iSCSI SSD Storage](https://smcleod.net/tech/ssd-storage-cluster-diagram/).

## Automation / Puppet

We're long time, heavy users of Puppet so naturally I'm deploying Gluster via a [Puppet module](https://github.com/voxpupuli/puppet-gluster) and generating volumes and volume configuration from [Hiera](https://docs.puppet.com/hiera/).

Volumes are automatically generated from the Hiera structure that defines our applications.

```shell
# profiles::services::gluster::volume:
profiles::services::gluster::volume::pool: "%{alias('profiles::services::gluster::host::pool')}"
profiles::services::gluster::volume::pool_members: "%{alias('profiles::services::gluster::host::pool_members')}"
profiles::services::gluster::volume::brick_mountpoint: '/mnt/gluster-storage'
profiles::services::gluster::volume::replica: 3
profiles::services::gluster::volume::arbiter: 1
profiles::services::gluster::volume::volume_options:
  # Failover clients after 10 seconds of a server being unavailable
  'network.ping-timeout': '10'
  'cluster.lookup-optimize': 'true'
  'cluster.readdir-optimize': 'true'
  'cluster.use-compound-fops': 'true'
  'performance.parallel-readdir': 'true'
  'performance.client-io-threads': 'true'
  'performance.stat-prefetch': 'true'
  'diagnostics.brick-log-level': 'WARNING'
  'diagnostics.client-log-level': 'WARNING'
  'server.event-threads': '3'
  'client.event-threads': '3'
```

I enabled the `nis_enabled` SEbool to prevent a number of SELinux denials I noticed in the logs:

```shell
profiles::os::redhat::centos7::selinux::selinux_booleans:
  'nis_enabled':
    value: 'on'
```

I also increased the local emepheral port range and the kernel's socket backlog limit as suggested by Redhat:

```shell
sysctl::base::values:
  'net.ipv4.tcp_max_syn_backlog':
    ensure: present
    value: '4096'
    comment: 'Increase syn backlogs for gluster'
  'net.ipv4.ip_local_port_range':
    ensure: present
    value: '32768 65535'
    comment: 'Increase local port range for gluster'
  'net.core.somaxconn':
    ensure: present
    value: '2048'
    comment: 'Increase kernel socket backlog limit for gluster'
```

## Performance

Performance is, well, very poor for anything other than large reads.

I was expecting a hit to IOP/s performance as you would with any clustered, network file system, but I wasn't expecting it to drop as much as it did, especially after enabling the above performance options on the volumes.

![gluster perf vs native.jpg]({{site.baseurl}}/img/gluster perf vs native.jpg)

### Sequential Read

Acceptable performance at 380MB/s:

```shell
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=1M --iodepth=32 --size=5G --readwrite=read
test: (g=0): rw=read, bs=1M-1M/1M-1M/1M-1M, ioengine=libaio, iodepth=32
fio-2.1.11
Starting 1 process
Jobs: 1 (f=1): [R(1)] [100.0% done] [380.0MB/0KB/0KB /s] [380/0/0 iops] [eta 00m:00s]
test: (groupid=0, jobs=1): err= 0: pid=509: Mon Sep 25 12:17:06 2017
  read : io=5120.0MB, bw=310321KB/s, iops=303, runt= 16895msec
  cpu          : usr=0.58%, sys=3.50%, ctx=16068, majf=0, minf=533
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.2%, 16=0.3%, 32=99.4%, >=64=0.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.1%, 64=0.0%, >=64=0.0%
     issued    : total=r=5120/w=0/d=0, short=r=0/w=0/d=0
     latency   : target=0, window=0, percentile=100.00%, depth=32

Run status group 0 (all jobs):
   READ: io=5120.0MB, aggrb=310321KB/s, minb=310321KB/s, maxb=310321KB/s, mint=16895msec, maxt=16895msec
```

### Sequential Write

A terrible average of 25.6MB/s:

```shell
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=1M --iodepth=32 --size=5G --readwrite=write
test: (g=0): rw=write, bs=1M-1M/1M-1M/1M-1M, ioengine=libaio, iodepth=32
fio-2.1.11
Starting 1 process
test: Laying out IO file(s) (1 file(s) / 5120MB)
Jobs: 1 (f=1): [W(1)] [18.9% done] [0KB/25600KB/0KB /s] [0/25/0 iops] [eta 01m:43s]
```

### 4K Write IOP/s

A terrible average of 684 IOP/s:

```shell
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=32 --size=5G --readwrite=randwrite
test: (g=0): rw=randwrite, bs=4K-4K/4K-4K/4K-4K, ioengine=libaio, iodepth=32
fio-2.1.11
Starting 1 process
Jobs: 1 (f=1): [w(1)] [1.2% done] [0KB/2736KB/0KB /s] [0/684/0 iops] [eta 34m:53s]
```

### 4K Read IOP/s

A terrible average of 3017 IOP/s:

```shell
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=32 --size=5G --readwrite=randread
test: (g=0): rw=randread, bs=4K-4K/4K-4K/4K-4K, ioengine=libaio, iodepth=32
fio-2.1.11
Starting 1 process
Jobs: 1 (f=1): [r(1)] [5.6% done] [12068KB/0KB/0KB /s] [3017/0/0 iops] [eta 07m:20s]
```

## Annoyances

### Open Files

Gluster seems to love open file handles, on an average node in the cluster with 120 small volumes connected to 3 fuse clients and no files I often see up to 1.5 _million_ open files:

```shell
root@int-gluster-02:~  # lsof | wc -l
1042782

root@int-gluster-01:~  # netstat -lnp|grep gluster|wc -l
111
```

### Inconsistent Configuration

A big gripe I have is with the location of cluster and volume configuration, it is kept in a number of different files and file locations, for example:

```shell
/etc/glusterfs/glusterd.vol
/var/lib/glusterd/options
/var/lib/glusterd/glusterd.info
/var/lib/glusterd/vols/simpleapp_static/quota.conf
/var/lib/glusterd/vols/simpleapp_static/trusted-simpleapp_static.tcp-fuse.vol
/var/lib/glusterd/vols/simpleapp_static/bricks/int-gluster-01\:-mnt-gluster-storage-simpleapp_static
```

This makes managing the cluster and volumes with automation tools a bit of a pain and thus most tooling calls out to the `gluster` command line application to set and read configuration which is not ideal.

### Memory Usage & Leaks

Along the way with Gluster from version 3.10 to 3.12 I've encountered _many_ memory leaks resulting in OOMs, corrupt volume configuration and often entire cluster rebuilds.

A lot of these seem to occur when making a large number of changes to volume configuration.

Often when Gluster runs out of memory and gets OOM killed, it corrupts `.vol` or `.info` files in `/var/lib/glusterd/vols/<volumes>/`, this causes the daemon to fail to start, requires you to hunt through logs for mentions of incorrectly configured volumes, delete the files in question and hope that they correctly sync back from another node, if they don't or can't be synced back it seems you might have to destroy the volumes (or cluster) and recreate them before restoring your (brick) data from backups - this is not at all fun.

### Poor Gluster CLI Performance

Again, because of the nature of cluster and volume configuration automation often has to call out to use the Gluster CLI tool to set or get information, this is made especially painful due to the tools performance - notably how long it takes to set / get options on volumes.

Setting a volume option on average takes around 1 second and the tool cannot set an option on multiple volumes at once.

This quickly adds up, suppose you have 200 volumes and you're setting 5 options on each volume, `200*5=1000 / 60` - that's _16.6 minutes just to set the options!_, this could be a real issue when recovering from a disaster scenario.

### Broken Links to Gluster.org and Gluster.readthedocs.io

Many times I've clicked on links to Gluster articles or documentation and have found them to be broken, it seems that Gluster.org has undergone changes and has not created redirects for existing permalinks.
