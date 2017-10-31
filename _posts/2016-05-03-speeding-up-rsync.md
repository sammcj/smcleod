---
title: Speeding Up Rsync
date: 2016-05-03
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-insidebuilding

---

The most common way to use Rsync is probably as such:

{% highlight bash %}
rsync -avr user@<source>:<source_dir> <dest_dir>
{% endhighlight %}

Resulting in 30-35MB/s depending on file sizes

This can be improved by using a more efficient, less secure encryption algorithm, disabling compression
and telling the SSH client to disable some unneeded features that slow things down.

With the settings below I have achieved 100MB/s (at work between VMs) and over 300MB/s at home between SSD drives.

{% highlight bash %}
rsync -arv --numeric-ids --progress -e "ssh -T -c aes256-gcm@openssh.com -o Compression=no -x" user@<source>:<source_dir> <dest_dir>
{% endhighlight %}

If you want to delete files at the DST that have been deleted at the SRC (obviously use with caution:

{% highlight bash %}
rsync -arv --numeric-ids --progress -e "ssh -T -c aes256-gcm@openssh.com -o Compression=no -x" user@<source>:<source_dir> <dest_dir> --delete
{% endhighlight %}

#### Points of note:

1. Because of the weak encryption used, it is not recommended for transferring files across hostile networks (such as the internet).
1. There are scenarios where enabling compression _can_ improve performance, i.e. if your network link is very slow and your files compress well.
1. Don't forget to forward your SSH keys to the host you're going to run it on! (`ssh-agent && ssh-add` ((if it's not already running)) `ssh -A user@host`)
1. If `aes256-gcm@openssh.com` isn't available for you due to using an old operating system, you can use `aes128-ctr`
