---
title: Direct-Attach SSD Storage – Performance & Comparisons
date: 2014-10-15
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: banner

---

Further to my earlier post on XenServer storage performance with regards to directly attaching storage from the host, I have been analysing the performance of various SSD storage options.
I have attached a HP DS2220sb storage blade to an existing server blade and compared performance with 4 and 6 SSD RAID-10 to our existing iSCSI SANs.

While the P420i RAID controller in the DS2220sb is clearly saturated and unable to provide throughput much over 1,100MB/s – the IOP/s available to PostgreSQL are still a very considerably performance improvement over our P4530 SAN – in fact, 6 SSD’s result in a 39.9x performance increase!

Click the image below for the results:

[![Click to Start Slides]({{ site.url }}/img/san/bladedirectattach.png)](https://ixa.io/wp-content/uploads/2015/01/SSDvsSAN.pdf)