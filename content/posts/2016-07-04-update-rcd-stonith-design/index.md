---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2016-07-04T00:00:00Z"
aliases:
  - /tech/2016/07/04/update-rcd-stonith-design
images: ["noah-kuhn-27481.jpg"]
featuredImagePreview: noah-kuhn-27481.jpg
tags:
- tech
- storage
- hardware
title: Update Delayed Serial STONITH Design
---

_note: This is a follow up post from [2015-07-21-rcd-stonith](https://smcleod.net/tech/2015/07/21/rcd-stonith/)_

### A Linux Cluster Base STONITH provider for use with modern Pacemaker clusters

This has since been accepted and merged into Fedora's code base and as such will make it's way to RHEL.

- Source Code: [Github](https://github.com/sammcj/fence_rcd_serial)
- [Diptrace](https://diptrace.com/download/download-diptrace/) CAD Design: [Github](https://github.com/sammcj/fence_rcd_serial/tree/master/CAD/STONTH_CAD_DESIGN_V3)
- I have open sourced the CAD circuit design and made this available within this repo under
[CAD Design and Schematics](CAD/STONTH_CAD_DESIGN_V3)
- Related RedHat Bug: [https://bugzilla.redhat.com/show_bug.cgi?id=1240868](https://bugzilla.redhat.com/show_bug.cgi?id=1240868)

#### `v1` vs `v2/v3` versions of the `rcd_serial` STONITH system

The v2/v3 cables include the following improvements:

- Have a connector on the outside of the server (that's female side runs from the reset pin 'hijacker') so that cables can be easily disconnected.
- Have a slightly improved circuit design.
- Have long thumb-screws on the RS232 serial connector that not longer accidentally unscrew the female RS232 connector in the server (whoops!).

![]({{< ref "/" >}}/img/v3_cable.jpg)
![]({{< ref "/" >}}/img/rcd_serial_v3_diagram.png)

#### 'Hijack' cable

All the 'Hijack' cable is, is essentially a small M-F extension cable for the motherboard front-panel (buttons/LED) PINs with one change:

- The two reset pins are 'hijacked' so you can add a connector to run out the back of the server a connection to the adjacent storage server's rcd_serial connector.

![]({{< ref "/" >}}/img/hijack.jpg)

![]({{< ref "/" >}}/img/clip_correct.jpeg)

---

Many thanks to:

- OurPCB (Board fabrication).
- Clusterlabs, Redhat and Fedora Teams, feedback and peer review.
- John Sutton for his [original design](http://www.init.hr/dev/cluster/glue/lib/plugins/stonith/rcd_serial.c) that served as inspiration.
