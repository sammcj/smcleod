---
title: "Enabling the new AMD P-State Driver on Fedora"
subtitle: "Very, it turns out..."
date: 2023-07-09T06:41:37
lastmod: 2023-07-09T07:41:37
author: Sam McLeod
description: "Enabling the new AMD P-State Driver on Fedora with Kernel 6.4"
keywords: ["tech", "linux", "fedora", "amd", "pstate", "kernel", "power", "performance"]
tags: ["Linux", "Performance"]
categories: ["Tech", "Linux"]
series: []
images: [""]
# featuredImagePreview: ""
hiddenFromHomePage: false
hiddenFromSearch: false
toc:
  enable: true
  auto: false
code:
  copy: true
  maxShownLines: 200
math: false
lightgallery: false
readingTime: false
showFullContent: false
asciinema: false
mermaid: true
draft: false
---

I recently had to replace my home server, in doing so I'm now running an AMD Ryzen 7600 on an ASRock X670 Pro RS motherboard.

I'm running Fedora 38 on it, and I noticed that the CPU was only scaling between 3000MHz and 3800MHz, which is the base and the first level boost clock of the CPU. I was expecting it to scale down to as low as 400Mhz when idle, and up to 5.17Ghz on boost.

## Investigation

```plain
cpupower frequency-info
analyzing CPU 0:
  driver: acpi-cpufreq
  CPUs which run at the same hardware frequency: 0
  CPUs which need to have their frequency coordinated by software: 0
  maximum transition latency:  Cannot determine or is not supported.
  hardware limits: 3.00 GHz - 5.17 GHz
  available frequency steps:  3.80 GHz, 3.00 GHz
  available cpufreq governors: conservative ondemand userspace powersave performance schedutil
  current policy: frequency should be within 3.00 GHz and 3.80 GHz.
                  The governor "ondemand" may decide which speed to use
                  within this range.
  current CPU frequency: 3.00 GHz (asserted by call to hardware)
  boost state support:
    Supported: yes
    Active: yes
    Boost States: 0
    Total States: 2
    Pstate-P0:  3800MHz
    Pstate-P1:  3000MHz
```

```bash
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_driver
acpi-cpufreq

cat /sys/devices/system/cpu/cpu0/cpuinfo_min_freq
3000000

cat /sys/devices/system/cpu/cpu0/cpuinfo_max_freq
3800000
```

```bash
zenstates.py -l
P0 - Enabled - FID = 98 - DID = 8 - VID = C9 - Ratio = 38.00 - vCore = 0.29375
P1 - Enabled - FID = 78 - DID = 8 - VID = 79 - Ratio = 30.00 - vCore = 0.79375
P2 - Disabled
P3 - Disabled
P4 - Disabled
P5 - Disabled
P6 - Disabled
P7 - Disabled
C6 State - Package - Enabled
C6 State - Core - Enabled
```

After a significant amount of reading and hunting through BIOS settings only to find that ASRock have removed the CPPC enablement setting.

I found that while the new AMD P-State driver was merged into the kernel - it didn't seem to load by default with kernel 6.3.11 which is the latest version in the Fedora 38 repositories.

Fedora is currently testing 6.4 and has test packages available, so I decided to give it a go - and it works perfectly.

## Installing the new kernel

The kernel itself is stable, but it's classed as a test package, so you'll need to enable the testing repository.

```bash
dnf install koji -y
koji list-builds --package=kernel --after="2023-07-07" --pattern "kernel-6.4*"
mkdir -p kernel_test && cd kernel_test
koji download-build --arch=x86_64 kernel-6.4.2-201.fc38
dnf update kernel-*.rpm
```

## Enable the driver

There's one more step before rebooting, we need to enable the new AMD P-State driver.

1. Edit `/etc/default/grub`, adding `amd_pstate=enable` to the `GRUB_CMDLINE_LINUX` line.
2. Update the bootloader `grub2-mkconfig -o /boot/grub2/grub.cfg; dracut -f`
3. Reboot

## Check it's working

```bash
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_driver
amd-pstate-epp

cat /sys/devices/system/cpu/cpu0/cpuinfo_min_freq
400000

cat /sys/devices/system/cpu/cpu0/cpuinfo_max_freq
5170000
```

That's the new pstate driver running and 400Mhz to 5.17Ghz!

And if we look at htop, we can see that individual CPU cores are scaling down to 400Mhz when idle:

```plain
    0[       0.0%  400MHz N/A ]   6[          0.0%  400MHz N/A] Tasks: 193, 773 thr, 250 kthr; 1 running
    1[       0.0% 3672MHz 40°C]   7[          0.0%  400MHz N/A] Systemd: running (0/739 failed) (0/411 jobs)
    2[       0.0%  400MHz N/A ]   8[|         0.7% 3592MHz N/A] Swp[                               0K/8.00G]
    3[       0.0%  400MHz N/A ]   9[|         0.7%  400MHz N/A] Load average: 0.49 0.30 0.20
    4[       0.0%  400MHz N/A ]  10[|         0.7% 3527MHz N/A] Disk IO: 0.0% read: 0KiB/s write: 0KiB/s
    5[       0.0%  400MHz N/A ]  11[||        1.3%  400MHz N/A] Network: rx: 2KiB/s tx: 1KiB/s (12/5 pkts/s)
  Mem[|||||||||||||||                                                         2.73G/65G] Uptime: 00:16:32
```

There's still something weird up with the hardware pstates which I suspect is something to do with the CPPC mode (action/passive etc...), but it doesn't seem to matter as the frequency scaling is working as expected.

```plain
cpupower frequency-info
analyzing CPU 8:
  driver: amd-pstate-epp
  CPUs which run at the same hardware frequency: 8
  CPUs which need to have their frequency coordinated by software: 8
  maximum transition latency:  Cannot determine or is not supported.
  hardware limits: 400 MHz - 5.17 GHz
  available cpufreq governors: performance powersave
  current policy: frequency should be within 400 MHz and 5.17 GHz.
                  The governor "powersave" may decide which speed to use
                  within this range.
  current CPU frequency: Unable to call hardware
  current CPU frequency: 3.34 GHz (asserted by call to kernel)
  boost state support:
    Supported: yes
    Active: yes
    Boost States: 0
    Total States: 2
    Pstate-P0:  3800MHz
    Pstate-P1:  3000MHz
```

I'm not sure if that's a bug in the driver or the tool, but it doesn't seem to matter 🤷.

## Conclusion

Great success!

![](https://upload.wikimedia.org/wikipedia/en/f/ff/SuccessKid.jpg)
