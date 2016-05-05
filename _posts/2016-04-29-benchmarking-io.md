---
title: Benchmarking IO with FIO
layout: post
published: True
tags: []
---

## This is a quick tldr; there are _many_ other situations and options you could consider.



* [FIO man page](http://linux.die.net/man/1/fio)
* IOP/s = Input or Output operations per second
* Throughput = How many MB/s can you read/write continuously



### Variables worth tuning based on your situation:



##### `--iodepth`

The iodepth is very dependant on your hardware.

* Rotational drives without much cache and high latency (i.e. desktop SATA drives) will not benefit from a large iodepth, Values between 16 to 64 could be sensible.
* High speed, lower latency SSDs (especially NVMe devices) can utilise a much higher iodepth, Values between 256 to 4096 could be sensible.


##### `--bs`

The block size is very dependant on your workload.

* Writing/Reading lots of small files (i.e. documents, logs) benefit from / represent a smaller block size, Values between 2K - 128K could be sensible and 4k is likely the average in most situations.

* Writing/Reading large files (i.e. videos, database backups) benefit from / represent a large block size, Values between 2M - 8M could be sensible and 4M is likely the average in most situations.



### Before running any of these tests:

1. Check you're in a directory with enough free disk space.
1. Check / pause any other workloads that may interfere with the results.
1. Understand your workload / what you intend to use the storage for - i.e. what matters?
1. Tune anything you might want to tune as above such as `iodepth` or `size`.



#### Random write test for IOP/s, i.e. lots of small files

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=256 --size=4G --readwrite=randwrite --prio=1 --ramp_time=4
```

#### Random Read test for IOP/s, i.e. lots of small files

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=256 --size=4G --readwrite=randread --prio=1 --ramp_time=4
```

#### Sequential write test for IOP/s, i.e. one large file

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=256 --size=4G --readwrite=write --prio=1 --ramp_time=4
```

#### Sequential Read test for IOP/s, i.e. one large file

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=256 --size=4G --readwrite=read --prio=1 --ramp_time=4
```

#### Random write test for throughput, i.e. lots of small files

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4M --iodepth=256 --size=10G --readwrite=randwrite --prio=1 --ramp_time=4
```

#### Random Read test for throughput

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4M --iodepth=256 --size=10G --readwrite=randread --prio=1 --ramp_time=4
```

#### Sequential write test for throughput, i.e. one large file

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4M --iodepth=256 --size=10G --readwrite=write --prio=1 --ramp_time=4
```

#### Sequential Read test for throughput, i.e. one large file

```bash
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4M --iodepth=256 --size=10G --readwrite=read --prio=1 --ramp_time=4
```



## A conversation Alex and I had about Disk I/O, disk caching and benchmarking IO.

Note: May/may not be informative to others - all the 'how to use fio' stuff I wrote is in the wiki and on my blog.

---

3:30:18 PM samm: step 1, read this: https://lonesysadmin.net/2013/12/22/better-linux-disk-caching-performance-vm-dirty_ratio/

3:30:27 PM samm: step 2, be confused about what to do

3:31:08 PM samm: step 3, sam just found this link that looks interesting, but I don't trust random hardware / kernel settings from random people on the internet - http://unix.stackexchange.com/a/41831

3:31:15 PM samm: step 4, be confused about what to do

3:33:32 PM samm: step 5, add the following to the server in puppet, it'd be good to not do this in the node, but you may have to unless all servers have quite a bit of ram:

```puppet
# Use lots of RAM for caching disk
  augeas::sysctl::conf {
    'vm.dirty_background_ratio':      value => '50';
    'vm.dirty_ratio':     value => '80';
  }
```

3:34:33 PM samm: the answer to the thing thats not a question is that 'Approach 2: Increasing the Cache' is usually the best option when you have A) lots of RAM and B) storage that doesn't matter if you lost a few seconds of data if the power completely went out and it was writing to disk

3:35:59 PM samm: step 6, int-backup-02 (and im assuming pm-backup-02) can have their large storage optimised as well by adding the mount option of commit=30 to their /mnt/store1 in /etc/fstab

3:36:35 PM samm: again, dont do that on servers where you cant handle 30s of written data loss if it failed

3:36:40 PM samm: backup servers == fine

2:13:38 PM samm: https://www.binarylane.com.au/support/solutions/articles/1000055889-how-to-benchmark-disk-i-o


```bash
2:14:31 PM samm: root@int-backup-01:/mnt/store1  # ioping . # old backup server
4096 bytes from . (ext4 /dev/mapper/store1-36TB): request=1 time=0.2 ms
4096 bytes from . (ext4 /dev/mapper/store1-36TB): request=2 time=0.1 ms
4096 bytes from . (ext4 /dev/mapper/store1-36TB): request=3 time=0.9 ms
```

vs

```
2:14:37 PM samm: root@int-backup-02:/mnt/store1  # ioping . # new backup server
4 KiB from . (ext4 /dev/md10): request=1 time=88 us
4 KiB from . (ext4 /dev/md10): request=2 time=103 us
4 KiB from . (ext4 /dev/md10): request=3 time=102 us
```
