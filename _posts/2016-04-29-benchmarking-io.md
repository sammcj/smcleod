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
fsync;fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=256 --size=4G --readwrite=randwrite --prio=1 --ramp_time=4
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