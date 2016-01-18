---
title: Fix XenServer SR with corrupt or invalid metadata
categories: []

---

If a disk / VDI is orphaned or only partially deleted you'll notice that under the SR it's not assigned to any VM.
This can cause issues that look like metadata corruption resulting in the inability to migrate VMs or edit storage.

For example:

{% highlight bash %}
[root@xenserver-host ~]# xe vdi-destroy uuid=6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
Error code: SR_BACKEND_FAILURE_181
Error parameters: , Error in Metadata volume operation for SR. [opterr=VDI delete operation failed for parameters: /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/MGT, 6c2cd848-ac0e-441c-9cd6-9865fca7fe8b. Error: Failed to write file with params [3, 0, 512, 512]. Error: 5],
{% endhighlight %}


## Removing stale VDIs

To fix this, you need to remove those VDIs from the SR after first deleting the logical volume:

* Get the LV ID (last number shown above) and find it's location in /dev:

{% highlight bash %}
[root@xenserver-host ~]# lvdisplay | grep 6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
LV Name                /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
{% endhighlight %}

*  Remove the logical volume:

{% highlight bash %}
[root@xenserver-host ~]# lvremove /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
Logical volume "VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b" successfully removed
{% endhighlight %}

*  Destroy the VDI:

{% highlight bash %}
[root@xenserver-host ~]# xe vdi-destroy uuid=6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
{% endhighlight %}


## Regenerate the MGT volume

If this doesn't work and the SR is still having metadata problems the MGT (management volume) may be corrupt.

Luckily this is easy to rebuild and doesn't require VMs to be powered off or migrated to another SR.

* Rescan the SR

{% highlight bash %}
xe sr-scan uuid=<SR UUID HERE>
{% endhighlight %}

* Rename the SR's MGT logical volume (this is safe and does not affect running VMs):

{% highlight bash %}
lvcrename /dev/VG_XenStorage-<SR UUID HERE>/MGT /dev/VG_XenStorage-<SR UUID HERE>/oldMGT
{% endhighlight %}

* Rescan the SR

Note: in some cases you might need to do this a couple of times.

{% highlight bash %}
xe sr-scan uuid=<SR UUID HERE>
{% endhighlight %}

* Remove any stale VDIs

Look for any VDIs without VMs on the SR in XenCentre or on the cli with:

{% highlight bash %}
xe vdi-list sr=<SR UUID HERE>
{% endhighlight %}

Remove them with:

{% highlight bash %}
[root@pm-b5 ~]# lvdisplay | grep 6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
  LV Name                /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b

[root@pm-b5 ~]# lvremove /dev/VG_XenStorage-3ae1df17-06ee-7202-eb92-72c266134e16/VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b
  Logical volume "VHD-6c2cd848-ac0e-441c-9cd6-9865fca7fe8b" successfully removed
{% endhighlight %}

* Rescan the SR

{% highlight bash %}
xe sr-scan uuid=<SR UUID HERE>
{% endhighlight %}