---
title: Update Delayed Serial STONITH Design
layout: post
tags: []
published: True
tags: Storage
---

_note: This is a follow up post from [2015-07-21-rcd-stonith]({% post_url 2015-07-21-rcd-stonith %})_

### A Linux Cluster Base STONITH provider for use with modern Pacemaker clusters.

This has since been accepted and merged into Fedora's code base and as such will make it's way to RHEL.

- Source Code: [Github](https://github.com/sammcj/fence_rcd_serial)
- [Diptrace] CAD Design: [Github](https://github.com/sammcj/fence_rcd_serial/tree/master/CAD/STONTH_CAD_DESIGN_V3)
- Device: https://smcleod.net/rcd-stonith/ (Warning: Contains somewhat outaged images / diagrams now)
- I have open sourced the CAD circuit design and made this available within this repo under
[CAD Design and Schematics](CAD/STONTH_CAD_DESIGN_V3)
- Related RedHat Bug: https://bugzilla.redhat.com/show_bug.cgi?id=1240868

Many thanks to:

- George Hansper (Assistance and peer review of electrical design).
- OurPCB (Board fabrication).
- Clusterlabs, Redhat and Fedora Teams, feedback and peer review.
- John Sutton for his [original design](http://www.init.hr/dev/cluster/glue/lib/plugins/stonith/rcd_serial.c) that served as inspiration.

![]({{ site.url }}/images/v3_cable.jpg)
![]({{ site.url }}/images/rcd_serial_v3_diagram.png)