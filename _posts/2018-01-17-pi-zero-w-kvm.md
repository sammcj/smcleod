---
title: Raspberry Pi Zero W IP-KVM
published: true
date: 2018-01-17
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-raspberry
---

Building a Raspberry Pi Zero W as a DIY HTML5 IP KVM/IPMI with (optional) wireless access.

![](https://github.com/sammcj/smcleod_files/blob/master/images/pi_kvm/pikvm.jpg?raw=true)

![](https://raw.githubusercontent.com/Fmstrat/diy-ipmi/master/Resources/Screenshot.png)

I found [this project on Github](https://github.com/Fmstrat/diy-ipmi) that looked to provide most of what I wanted however:

- I don't want / think you should need both a Pi and a Pi Zero
- It needed minor updates for Raspbian based on Debian 9.x and PHP7
- I don't really like that it requires PHP (but haven't fixed that yet)
- I don't like that it uses rc.local

So, I followed most of the steps in the README.md and [Fmstrat](https://github.com/Fmstrat)'s PHP (for now), but not the install script itself.

### TODO:

- Add virtual CDROM/ISO/IMG mounting via the web interface
- Replace the PHP with something less... PHP
- Replace items in rc.local with a proper systemd unit
- Connect and test reset jumper
- Merge requests for above

### Parts

- 1x [Raspberry Pi Zero W](https://www.raspberrypi.org/products/raspberry-pi-zero-w/)
- 1x [Raspberry Pi Zero Case](https://raspberry.piaustralia.com.au/raspberry-pi-zero-case)
- 1x [MicroSD card](https://www.ebay.com.au/sch/i.html?_from=R40&_trksid=p2047675.m570.l1313.TR0.TRC0.H0.X16GB+SanDisk+Ultra+microsd.TRS0&_nkw=16GB+SanDisk+Ultra+microsd&_sacat=0) (I recommend a 8-16GB Sandisk Ultra)
- 1x [USB HDMI Capture Card](https://www.ebay.com.au/itm/USB2-0-HDMI-Acquisition-Monitor-HDMI-Video-Capture-Card-Fast-Data-Transfer-VC/132455406353)
- 1x [Micro USB (male) to USB-A (female)](https://www.ebay.com/itm/USB-A-Female-to-Micro-USB-5-Pin-Male-Adapter-Host-OTG-Data-Charger-Cable-UL/161863950879), used for the USB HDMI input
- 1x [Micro USB (male) to USB-A (male)](https://www.ebay.com/b/USB-Type-Micro-B-Male-To-Male-Cables/44932/bn_357507), used to power the Pi and control keyboard / mouse of the host
- 1x [HDMI cable (short)](https://www.ebay.com.au/itm/Full-HD-Short-HDMI-Male-to-Male-Plug-Flat-Cable-Cord-for-Audio-Video-HDTV-Ext-/173021169691b)

### Software

- Raspbian Minimal Install
- The HTML5 IPMI KVM code from [Fmstrat's DIY-IPMI project](https://github.com/Fmstrat/diy-ipmi)

### Additional Links


- [Raspberry Pi OTG mode to emulate keyboard, mass storage and other input](https://gist.github.com/gbaman/50b6cca61dd1c3f88f41)
- [How to enable SSH via the Pi Zero's USB interface](https://www.thepolyglotdeveloper.com/2016/06/connect-raspberry-pi-zero-usb-cable-ssh/)
- [How to enable SSH via network interfaces](https://hackernoon.com/raspberry-pi-headless-install-462ccabd75d0)

_Credit and shout out to [Fmstrat](https://github.com/Fmstrat) for the groundwork and it's his browser screenshot I've linked to in this post_