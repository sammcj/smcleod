---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-07-24T00:00:00Z"
aliases:
  - /tech/2015/07/24/scsi-benchmarking/
image: datacentre-1.jpg
featuredImagePreview: datacentre-1.jpg
tags:
- tech
- storage
- hardware
title: iSCSI Benchmarking
---

The following are benchmarks from our testings of our iSCSI SSD storage.

### 67,300 read IOP/s on a VM on iSCSI

- (Disk -> LVM -> MDADM -> DRBD -> iSCSI target -> Network -> XenServer iSCSI Client -> VM)
- Per VM and scales to 1,000,000 IOP/s total

```shell
root@dev-samm:/mnt/pmt1 128 # fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=128 --size=2G --readwrite=read
test: (g=0): rw=read, bs=4K-4K/4K-4K, ioengine=libaio, iodepth=128
2.0.8
Starting 1 process
bs: 1 (f=1): [R] [55.6% done] [262.1M/0K /s] [67.3K/0  iops] [eta 00m:04s]
```

### 38,500 random 4k write IOP/s on a VM on iSCSI

- (Disk -> LVM -> MDADM -> DRBD -> iSCSI target -> Network -> XenServer iSCSI Client -> VM)
- Per VM and scales to 700,000 IOP/s total

```shell
root@dev-samm:/mnt/pmt1 # fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=test --bs=4k --iodepth=128 --size=2G --readwrite=randwrite
test: (g=0): rw=randwrite, bs=4K-4K/4K-4K, ioengine=libaio, iodepth=128
2.0.8
Starting 1 process
bs: 1 (f=1): [w] [26.3% done] [0K/150.2M /s] [0 /38.5K iops] [eta 00m:14s]
```

### Raw device latency on storage units

- Intel DC3600 1.2T PCIe NVMe

```shell
root@s1-san6:/proc  # ioping /dev/nvme0n1p1
4.0 KiB from /dev/nvme0n1p1 (device 1.1 TiB): request=1 time=104 us
4.0 KiB from /dev/nvme0n1p1 (device 1.1 TiB): request=2 time=83 us
4.0 KiB from /dev/nvme0n1p1 (device 1.1 TiB): request=3 time=51 us
4.0 KiB from /dev/nvme0n1p1 (device 1.1 TiB): request=4 time=71 us
```

- SanDisk SDSSDXPS960G SATA

```shell
root@pm-san5:/proc  # ioping /dev/sdc
4.0 KiB from /dev/sdc (device 894.3 GiB): request=1 time=4.2 ms
4.0 KiB from /dev/sdc (device 894.3 GiB): request=2 time=4.1 ms
4.0 KiB from /dev/sdc (device 894.3 GiB): request=3 time=4.1 ms
4.0 KiB from /dev/sdc (device 894.3 GiB): request=4 time=4.1 ms
```

- Micron_M600_MTFDDAK1T0MBF SATA

```shell
root@pm-san5:/proc  # ioping /dev/sdf
4.0 KiB from /dev/sdf (device 953.9 GiB): request=1 time=157 us
4.0 KiB from /dev/sdf (device 953.9 GiB): request=2 time=190 us
4.0 KiB from /dev/sdf (device 953.9 GiB): request=3 time=65 us
4.0 KiB from /dev/sdf (device 953.9 GiB): request=4 time=181 us
```shell
## Latency on the a VM

- (Disk -> LVM -> MDADM -> DRBD -> iSCSI target -> Network -> XenServer iSCSI Client -> VM)

```shell
root@dev-samm:/mnt 127 # ioping pmt1/
4096 bytes from pmt1/ (ext4 /dev/xvdb1): request=1 time=0.6 ms
4096 bytes from pmt1/ (ext4 /dev/xvdb1): request=2 time=0.7 ms
4096 bytes from pmt1/ (ext4 /dev/xvdb1): request=3 time=0.7 ms

--- pmt1/ (ext4 /dev/xvdb1) ioping statistics ---
3 requests completed in 2159.1 ms, 1508 iops, 5.9 mb/s
min/avg/max/mdev = 0.6/0.7/0.7/0.1 ms
root@dev-samm:/mnt  # ioping pmt2/
4096 bytes from pmt2/ (ext4 /dev/xvdc1): request=1 time=0.6 ms
4096 bytes from pmt2/ (ext4 /dev/xvdc1): request=2 time=0.8 ms

--- pmt2/ (ext4 /dev/xvdc1) ioping statistics ---
2 requests completed in 1658.4 ms, 1470 iops, 5.7 mb/s
min/avg/max/mdev = 0.6/0.7/0.8/0.1 ms
root@dev-samm:/mnt  # ioping pmt3/
4096 bytes from pmt3/ (ext4 /dev/xvde1): request=1 time=0.6 ms
4096 bytes from pmt3/ (ext4 /dev/xvde1): request=2 time=0.9 ms
4096 bytes from pmt3/ (ext4 /dev/xvde1): request=3 time=0.9 ms
```

![](https://smcleod.net/images/san/lcmcpcmk.png)

![](https://smcleod.net/images/san/supermicrox2.jpg)
