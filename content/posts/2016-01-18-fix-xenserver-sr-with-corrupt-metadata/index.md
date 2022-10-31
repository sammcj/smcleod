---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2016-01-18T00:00:00Z"
aliases:
  - /tech/2016/01/18/fix-xenserver-sr-with-corrupt-metadata/
image: samuel-zeller-358865.jpg
featuredImagePreview: samuel-zeller-358865.jpg
tags:
- tech
- storage
- xen
title: Fix XenServer SR with corrupt or invalid metadata
---

If a disk / VDI is orphaned or only partially deleted you'll notice that under the SR it's not assigned to any VM.

This can cause issues that look like metadata corruption resulting in the inability to migrate VMs or edit storage.

For example:

```shell
[root@xenserver-host ~]# xe vdi-destroy uuid=6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
Error code: SR_BACKEND_FAILURE_181
Error parameters: , Error in Metadata volume operation for SR. [opterr=VDI delete operation failed for parameters:
  /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/MGT, 6c2cd848-ac0e-441c-9cd6-9865fca7fe8b.
  Error: Failed to write file with params [3, 0, 512, 512]. Error: 5],
```


## Removing stale VDIs

To fix this, you need to remove those VDIs from the SR after first deleting the logical volume:

* Get the LV ID (last number shown above) and find it's location in /dev:

```shell
[root@xenserver-host ~]# lvdisplay | grep 6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
LV Name                /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
```

* Remove the logical volume:

```shell
[root@xenserver-host ~]# lvremove /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
Logical volume "VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b" successfully removed
```

* Destroy the VDI:

```shell
[root@xenserver-host ~]# xe vdi-destroy uuid=6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
```

## Regenerate the MGT volume

If this doesn't work and the SR is still having metadata problems the MGT (management volume) may be corrupt.

Luckily this is easy to rebuild and doesn't require VMs to be powered off or migrated to another SR.

* Rescan the SR

```shell
xe sshellr-scan uuid=<SR UUID HERE>
```

* Rename the SR's MGT logical volume (this is safe and does not affect running VMs):

```shell
lvcrshellename /dev/VG_XenStorage-<SR UUID HERE>/MGT /dev/VG_XenStorage-<SR UUID HERE>/oldMGT
```

* Rescan the SR

Note: in some cases you might need to do this a couple of times.

```shell
xe sshellr-scan uuid=<SR UUID HERE>
```

* Remove any stale VDIs

Look for any VDIs without VMs on the SR in XenCentre or on the cli with:

```shell
xe vshelldi-list sr=<SR UUID HERE>
```

Remove them with:

```shell
[root@pm-b5 ~]# lvdisplay | grep 6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
  LV Name                /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b

[root@pm-b5 ~]# lvremove /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
  Logical volume "VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b" successfully removed
```

* Rescan the SR

```shell
xe sshellr-scan uuid=<SR UUID HERE>
```
