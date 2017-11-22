---
title: Monitoring SystemD Units With Nagios
date: 2016-05-23
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-colosseum-rome

---

_Ever forgotten to add a critical service to monitoring?_

_Want to know if a service or process fails without explicitly monitoring every service on a host?_

...Then why not use SystemD's existing knowledge of all the enabled services? Thanks to 'Kbyte' who made a simple Nagios plugin to do just this!


Requirements:

- Python3 (For RHEL/CentOS 7 `yum install python34`)
- python-nagiosplugin [My pre-built RPMs](https://packagecloud.io/app/s_mcleod/centos7/search?q=python-nagiosplugin) or `pip3 install nagiosplugin`
- [PyNagSystemD](https://github.com/kbytesys/pynagsystemd/blob/master/bin/pynagsystemd.py)

Screenshot:

![](http://kbyte.snowpenguin.org/portal/wp-content/uploads/2014/11/nagios.png)
