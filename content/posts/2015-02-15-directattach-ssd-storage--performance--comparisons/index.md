---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-02-15T00:00:00Z"
aliases:
  - /tech/2014/10/15/directattach-ssd-storage-performance-comparisons/
image: banner.jpg
featuredImagePreview: banner.jpg
tags:
- tech
- storage
- hardware
title: Direct-Attach SSD Storage - Performance & Comparisons
---

Further to my earlier post on XenServer storage performance with regards to directly attaching storage from the host, I have been analysing the performance of various SSD storage options.

I have attached a HP DS2220sb storage blade to an existing server blade and compared performance with 4 and 6 SSD RAID-10 to our existing iSCSI SANs.

While the P420i RAID controller in the DS2220sb is clearly saturated and unable to provide throughput much over 1,100MB/s - the IOP/s available to PostgreSQL are still a very considerably performance improvement over our P4530 SAN - in fact, 6 SSD's result in a 39.9x performance increase!

Click the image below for the results:

[![Click to Start Slides]({{< ref "/" >}}/img/san/bladedirectattach.png)](https://ixa.io/wp-content/uploads/2015/01/SSDvsSAN.pdf)

<!-- #TODO: fix broken link to SSDvsSAN.pdf -->
