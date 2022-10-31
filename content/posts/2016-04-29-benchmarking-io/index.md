---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2016-04-29T00:00:00Z"
aliases:
  - /tech/2016/04/29/benchmarking-io
image: daniel-mayovskiy-303666.jpg
featuredImagePreview: daniel-mayovskiy-303666.jpg
tags:
- tech
- storage
title: Benchmarking IO with FIO
---

## This is a quick tldr there are _many_ other situations and options you could consider

* [FIO man page](http://linux.die.net/man/1/fio)
* IOP/s = Input or Output operations per second
* Throughput = How many MB/s can you read/write continuously

### Variables worth tuning based on your situation

* `--iodepth`

The iodepth is very dependant on your hardware.

* Rotational drives without much cache and high latency (i.e. desktop SATA drives) will not benefit from a large iodepth, Values between 16 to 64 could be sensible.
* High speed, lower latency SSDs (especially NVMe devices) can utilise a much higher iodepth, Values between 256 to 4096 could be sensible.

* `--bs`

The block size is very dependant on your workload.

* Writing/Reading lots of small files (i.e. documents, logs) benefit from / represent a smaller block size, Values between 2K - 128K could be sensible and 4k is likely the average in most situations.

* Writing/Reading large files (i.e. videos, database backups) benefit from / represent a large block size, Values between 2M - 8M could be sensible and 4M is likely the average in most situations.

### Before running these tests

1. Check you're in a directory with enough free disk space.
1. Check / pause any other workloads that may interfere with the results.
1. Understand your workload / what you intend to use the storage for - i.e. what matters?
1. Tune anything you might want to tune as above such as `iodepth` or `size`.

#### Random write test for IOP/s

i.e. lots of small files

```shell
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=64 --size=4G --readwrite=randwrite --ramp_time=4
```

#### Random Read test for IOP/s

i.e. lots of small files

```shell
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=64 --size=4G --readwrite=randread --ramp_time=4
```

#### Sequential write test for throughput

i.e. one large file

```shell
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4M --iodepth=64 --size=4G --readwrite=write --ramp_time=4
```

#### Sequential Read test for throughput

i.e. one large file

```shell
sync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4M --iodepth=64 --size=4G --readwrite=read --ramp_time=4
```

#### Testing IO latency without fio

```shell
samm@int-backup-01:/mnt/store1  # ioping . # old backup server
4096 bytes from . (ext4 /dev/mapper/store1-36TB): request=1 time=0.2 ms
4096 bytes from . (ext4 /dev/mapper/store1-36TB): request=2 time=0.1 ms
4096 bytes from . (ext4 /dev/mapper/store1-36TB): request=3 time=0.9 ms
```

vs

```shell
samm@int-backup-02:/mnt/store1  # ioping . # new backup server
4 KiB from . (ext4 /dev/md10): request=1 time=88 us
4 KiB from . (ext4 /dev/md10): request=2 time=103 us
4 KiB from . (ext4 /dev/md10): request=3 time=102 us
```
