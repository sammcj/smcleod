---
title: 'New Apple Silicon M4 & M5 HiDPI Limitation on 4K External Displays'
slug: 'apple-silicon-4k-limitations'
date: 2026-03-29T01:00:00+10:00
tags: ['apple', '4k', 'monitor', 'software', 'hardware', 'bugs']
author: 'Sam McLeod'
showToc: true
TocOpen: true
draft: false
hidemeta: false
comments: false
description: 'A regression in external display support on Apple Silicon M4/M5 generation chips prevents full HiDPI modes on 4K monitors, limiting users to either blurry non-HiDPI or reduced workspace HiDPI.'
disableShare: false
disableHLJS: false
hideSummary: false
searchHidden: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowRssButtonInSectionTermList: true
UseHugoToc: true
mermaid: false
---

Starting with the M4 and including the new M5 generations of Apple Silicon, macOS no longer offers or allows full-resolution HiDPI 4k modes for external displays.

The maximum HiDPI mode available on a 3840x2160 panel is now just 3360x1890 (with a 6720x3780, instead of 7680x4320 backing store) - M2/M3 machines did not have this limitation.

With this regression Apple is leaving users to choose between:

- Full screen real estate at 4k (3840x2160) with blurry text due to HiDPI being disabled.

or

- Reduced screen real estate at 3.3k (3360x1890) with sharp text (HiDPI) but significantly less usable working space, and macOS's UI looking ridiculously oversized.

**This does not appear to be a hardware limitation**

The DCP (Display Coprocessor) reports identical capabilities on both M2 Max and M5 Max for the same display. The M5 Max hardware supports 8K (7680x4320) at 60Hz per Apple's own specs. Something in the software stack between the DCP and WindowServer is refusing to generate the mode - the details of why are explored below.

![System Settings > Display on a M5 Max](macOS.jpeg)

## Environment and Test Setup

| Property          | M5 Max (affected)                           | M2 Max (working)                            |
| ----------------- | ------------------------------------------- | ------------------------------------------- |
| Chip              | Apple M5 Max                                | Apple M2 Max                                |
| Model ID          | Mac17,6                                     | Mac14,6                                     |
| GPU Cores         | 40                                          | 38                                          |
| macOS             | 26.4 (25E246)                               | 26.4 (25E246)                               |
| Display           | LG HDR 4K 32UN880                           | LG HDR 4K 32UN880                           |
| Native Resolution | 3840x2160                                   | 3840x2160                                   |
| Connection        | USB-C/Thunderbolt, HBR3 (8.1 Gbps), 4 lanes | USB-C/Thunderbolt, HBR3 (8.1 Gbps), 4 lanes |
| Max HiDPI Mode    | **3360x1890**                               | **3840x2160**                               |

Both machines report identical DCP parameters for the LG display:

```
MaxActivePixelRate  = 497,664,000
MaxTotalPixelRate   = 537,600,000
MaxW                = 3840
MaxH                = 2160
MaxBpc              = 10
```

## Diagnosis and Troubleshooting

### Display Override Plist (scale-resolutions)

**What**: Wrote a display override plist to `/Library/Displays/Contents/Resources/Overrides/DisplayVendorID-1e6d/DisplayProductID-7750` containing scale-resolutions entries for 7680x4320 HiDPI.

**Result**: No effect on M5 Max. The identical plist produces 3840x2160 HiDPI on M2 Max. WindowServer on M5 Max refuses to enumerate the mode regardless of plist content.

The override plist that works on M2 Max:

```xml
<dict>
    <key>default-resolution</key>
    <data>AA8AAIhwAAAAPA==</data>  <!-- 3840x2160@60 -->
    <key>DisplayProductID</key>
    <integer>30544</integer>
    <key>DisplayVendorID</key>
    <integer>7789</integer>
    <key>scale-resolutions</key>
    <array>
        <data>AAAeAAAAEOAAAAAJACAAAA==</data>  <!-- 7680x4320 HiDPI -->
        <data>AAAeAAAAEOA=</data>               <!-- 7680x4320 -->
        <data>AAAPAAAACHA=</data>               <!-- 3840x2160 -->
    </array>
</dict>
```

### EDID Patching (Software Override)

**What**: Wrote a patched EDID into the override plist's `IODisplayEDID` key with:

- Preferred timing doubled to 4095x4095 (12-bit EDID field maximum)
- Pixel clock set to maximum (655.35 MHz)
- Range limits boosted to 2550 MHz max pixel clock, 255 kHz max H-freq, 255 Hz max V-freq

**Result**: No effect with these values. However, waydabber (BetterDisplay developer) [has confirmed](https://github.com/waydabber/BetterDisplay/discussions/4215) that software EDID overrides _can_ work on M4 - he got an 8K framebuffer on a 4K TV by adding a valid 8K timing and defining it as the native resolution. My attempt likely failed because 4095x4095 isn't a real display timing. The catch: even with a correct override, a 4K panel can't actually accept an 8K signal, so this confirms the mechanism (scaled modes derive from the system's idea of native resolution) without providing a practical fix.

### EDID Flash to Monitor EEPROM

**What**: Created a patched EDID binary with boosted range limits (keeping preferred timing at native 3840x2160 to avoid breaking display output), attempted to flash to the LG monitor's EEPROM via BetterDisplay's "Upload EDID" feature.

**Result**: The flash did not take effect. The monitor continued serving the original EDID. The LG 32UN880's EEPROM may be read-only, or BetterDisplay's DDC write failed silently. Even if successful, this approach would only change range limits, not the preferred timing that the DCP derives MaxW/MaxH from.

### IOKit Registry Override (DisplayHints)

**What**: Attempted to modify the DCP's `DisplayHints` dictionary and `ConnectionMapping` array directly in the IOKit registry using `IORegistryEntrySetCFProperty`, targeting higher MaxW, MaxH, and MaxActivePixelRate values.

**Result**: The DCP driver explicitly rejects userspace property writes with `kIOReturnUnsupported` (kern_return=-536870201). These properties are owned by the kernel-level `AppleDisplayCrossbar` driver and cannot be modified from userspace.

### Display Re-probe

**What**: Used `IOServiceRequestProbe` to trigger the DCP to re-read display information after writing override plists.

**Result**: No effect on mode enumeration. The DCP re-reads from the physical display, not from software overrides.

### WindowServer Cache Clearing

**What**: Deleted `~/Library/Preferences/ByHost/com.apple.windowserver.displays.*.plist` and attempted to restart WindowServer. Also performed a full reboot.

**Result**: `killall WindowServer` on macOS 26 does not actually restart WindowServer (no display flicker, no session interruption). Full reboot with the override plist in place still did not produce the 3840x2160 HiDPI mode. The cache was not the issue.

### Reducing Connected Display Count

**What**: Disconnected the third display (U13ZA) to test whether the DCP's bandwidth budget across display pipes was the constraint.

**Result**: No effect. With only 2 displays (LG + built-in), the mode list remained identical. The limitation is not related to the number of connected displays.

### HDMI vs USB-C/Thunderbolt

**What**: Considered switching from USB-C/DisplayPort to HDMI.

**Result**: Not attempted; HDMI 2.0 has less bandwidth (14.4 Gbps vs 25.92 Gbps on DP 1.4 HBR3), so would be the same or worse.

### SkyLight Private API (SLConfigureDisplayWithDisplayMode)

**What**: Used `SLConfigureDisplayWithDisplayMode` from the private SkyLight framework to attempt to directly apply a 3840x2160 HiDPI mode (7680x4320 pixel backing, scale=2.0) to the LG display. The mode was sourced from both the CG mode list and from other displays.

**Result**: Returns error code 1000 when the mode is not in the display's own mode list. The SkyLight display configuration API validates modes against the same DCP-derived mode list as WindowServer. There is no private API path to bypass the mode list validation.

## Where the limit is applied

The DCP reports identical capability parameters on both machines - `MaxActivePixelRate`, `MaxW`, `MaxH`, `MaxTotalPixelRate` all match. These come from the display's EDID, so that's expected.

The difference shows up in WindowServer's mode list. On M2 Max, `CGSGetNumberOfDisplayModes` includes 3840x2160 at scale=2.0. On M5 Max, with the same DCP parameters and the same override plists, that mode doesn't exist.

### What we think is happening

BetterDisplay developer waydabber ([discussion #4215](https://github.com/waydabber/BetterDisplay/discussions/4215)) describes the change:

> "Generally 3840x2160 HiDPI is not available with any M4 generation Mac on non-8K displays due to the new dynamic nature of how the system allocates resources. There might be exceptions maybe - when the system concludes that no other displays could be attached and there are resources left still for a higher resolution framebuffer. But normally the system allocates as low framebuffer size as possible, anticipating further displays to be connected and saving room for those."

The observable facts:

- The DCP reports identical capabilities on M2 Max and M5 Max (same `MaxW`, `MaxH`, `MaxActivePixelRate`)
- WindowServer's mode list on M5 Max tops out at 3360x1890 HiDPI (6720x3780 backing store) instead of 3840x2160 HiDPI (7680x4320 backing store)
- Disconnecting other displays doesn't change this
- Software EDID overrides may be able to influence mode generation (waydabber confirmed this by spoofing an 8K native resolution on M4), but only by lying about the display's native resolution - which means the display can't actually use the resulting signal

The scaled resolution modes on M4/M5 are derived from whatever the system believes is the display's native resolution. On M2/M3, the system would generate HiDPI modes up to 2.0x the native resolution (so 3840x2160 native got you a 7680x4320 backing store). On M4/M5, this tops out at around 1.75x. You can trick the system by overriding the EDID to claim a higher native resolution, but then the display can't actually handle the signal, so it's not a practical workaround for 4K panels.

---

## What could fix this

This needs a change from Apple - either to the scaling ratio limit in the mode generation logic, or a user-facing override. I've filed Apple Feedback FB22365722.

A 5K or 8K panel may not hit the exact same limit since its EDID native resolution is high enough that 1.75x scaling still provides a usable backing store.

## Appendix: Diagnostic Commands and Output

Commands to reproduce this on any Mac. All except #3 work without special permissions.

### Diagnostic commands

```bash
# 1. DCP rate limits and native caps per display
ioreg -l -w0 | grep -o '"MaxActivePixelRate"=[0-9]*\|"MaxW"=[0-9]*\|"MaxH"=[0-9]*' \
  | paste - - - | sort -u

# 2. System profiler display summary
system_profiler SPDisplaysDataType

# 3. All HiDPI modes for a display (requires Screen Recording permission)
#    Use BetterDisplay, SwitchResX, or any tool that calls
#    CGSGetNumberOfDisplayModes / CGSGetDisplayModeDescriptionOfLength.
#    Example output format shown below.

# 4. Display connection details and DisplayHints
ioreg -l -w0 | grep -B5 -A2 'MaxActivePixelRate' | grep -v EventLog

# 5. ConnectionMapping (per-pipe allocation)
ioreg -l -w0 | grep "ConnectionMapping"
```

### M2 Max (Mac14,6) - Working

Display: LG HDR 4K 32UN880 (3840x2160) via USB-C/Thunderbolt, macOS 26.4.

> Note: Commands 2, 4, 5 were captured without the LG connected. The mode list (command 3) was captured with the LG connected in a separate session.

**Command 1 - DCP rate limits:**

```
"MaxW"=3840     "MaxActivePixelRate"=497664000  "MaxH"=2160
"MaxW"=3840     "MaxActivePixelRate"=552950718  "MaxH"=2400
```

**Command 2 - System profiler (LG not connected at capture time):**

```
Graphics/Displays:

    Apple M2 Max:

      Chipset Model: Apple M2 Max
      Type: GPU
      Bus: Built-In
      Total Number of Cores: 38
      Vendor: Apple (0x106b)
      Metal Support: Metal 4
      Displays:
        Color LCD:
          Display Type: Built-in Liquid Retina XDR Display
          Resolution: 3456 x 2234 Retina
          Main Display: Yes
          Mirror: Off
          Online: Yes
          Automatically Adjust Brightness: No
          Connection Type: Internal
```

**Command 3 - HiDPI modes (LG connected, top 5):**

```
mode: {resolution=3840x2160, scale = 2.0, freq = 60, bits/pixel = 16}
mode: {resolution=3840x2160, scale = 2.0, freq = 30, bits/pixel = 16}
mode: {resolution=3360x1890, scale = 2.0, freq = 60, bits/pixel = 16}
mode: {resolution=3360x1890, scale = 2.0, freq = 30, bits/pixel = 16}
mode: {resolution=3200x1800, scale = 2.0, freq = 60, bits/pixel = 16}
```

Note: **3840x2160 at scale = 2.0 is present** as the highest available HiDPI mode.

**Command 4 - Display connection details (LG not connected at capture time):**

```
DisplayHints = {}
```

When LG is connected, reports identical values to M5 Max:

```
"DisplayHints" = {
    "MaxBpc"=10,
    "EDID UUID"="1E6D5077-0000-0000-0520-0104B5462878",
    "MaxTotalPixelRate"=537600000,
    "MaxW"=3840,
    "MaxActivePixelRate"=497664000,
    "Tiled"=No,
    "ProductName"="LG HDR 4K",
    "MaxH"=2160
}
```

**Command 5 - ConnectionMapping (LG not connected at capture time):**

```
"ConnectionMapping" = ()
```

### M5 Max (Mac17,6) - Affected

Display: LG HDR 4K 32UN880 (3840x2160) via USB-C/Thunderbolt, macOS 26.4.

**Command 1 - DCP rate limits:**

```
"MaxW"=3840     "MaxActivePixelRate"=497664000  "MaxH"=2160
"MaxW"=3840     "MaxActivePixelRate"=552950718  "MaxH"=2400
```

Identical to M2 Max.

**Command 2 - System profiler:**

```
Graphics/Displays:

    Apple M5 Max:

      Chipset Model: Apple M5 Max
      Type: GPU
      Bus: Built-In
      Total Number of Cores: 40
      Vendor: Apple (0x106b)
      Metal Support: Metal 4
      Displays:
        LG HDR 4K:
          Resolution: 6720 x 3780
          UI Looks like: 3360 x 1890 @ 60.00Hz
          Main Display: Yes
          Mirror: Off
          Online: Yes
          Rotation: Supported
        Color LCD:
          Display Type: Built-in Liquid Retina XDR Display
          Resolution: 3456 x 2234 Retina
          Mirror: Off
          Online: Yes
          Automatically Adjust Brightness: Yes
          Connection Type: Internal
        U13ZA:
          Resolution: 3840 x 2400 (WQUXGA)
          UI Looks like: 1920 x 1200 @ 60.00Hz
          Mirror: Off
          Online: Yes
          Rotation: Supported
```

Note: The LG's backing store is 6720x3780 (3360x1890 HiDPI). This is 1.75x the native resolution, not the 2.0x (7680x4320) needed for 3840x2160 HiDPI.

**Command 3 - HiDPI modes (top 5):**

```
mode: {resolution=3360x1890, scale = 2.0, freq = 60, bits/pixel = 16}
mode: {resolution=3360x1890, scale = 2.0, freq = 30, bits/pixel = 16}
mode: {resolution=3200x1800, scale = 2.0, freq = 60, bits/pixel = 16}
mode: {resolution=3200x1800, scale = 2.0, freq = 30, bits/pixel = 16}
mode: {resolution=3008x1692, scale = 2.0, freq = 60, bits/pixel = 16}
```

Note: **3840x2160 at scale = 2.0 is absent.** Maximum HiDPI is 3360x1890.

**Command 4 - Display connection details:**

```
"DisplayHints" = {
    "MaxBpc"=10,
    "EDID UUID"="1E6D5077-0000-0000-0520-0104B5462878",
    "MaxTotalPixelRate"=537600000,
    "MaxW"=3840,
    "MaxActivePixelRate"=497664000,
    "Tiled"=No,
    "ProductName"="LG HDR 4K",
    "MaxH"=2160
}
```

Identical to M2 Max.

**Command 5 - ConnectionMapping:**

```
"ConnectionMapping" = (
    {
        "MaxW"=3840,
        "MaxTotalPixelRate"=537600000,
        "MaxActivePixelRate"=497664000,
        "ProductName"="LG HDR 4K",
        "Address"="0.2.0",
        "PipeIDs"=(0),
        "MaxPipes"=1,
        "MaxH"=2160
    },
    {
        "MaxW"=3840,
        "MaxTotalPixelRate"=594000000,
        "MaxActivePixelRate"=552950718,
        "ProductName"="U13ZA",
        "Address"="0.0.1",
        "PipeIDs"=(1),
        "MaxPipes"=1,
        "MaxH"=2400
    }
)
```

### Key observation

DCP-reported capabilities are identical between M2 Max and M5 Max for the same display. The difference is in whatever generates the mode list between the DCP layer and WindowServer.

## References

- [BetterDisplay Discussion #4215](https://github.com/waydabber/BetterDisplay/discussions/4215) - waydabber's description of the M4-generation limitation
- [Apple M5 Max specifications](https://www.apple.com/macbook-pro/specs/) - claims 8K (7680x4320) at 60Hz over Thunderbolt
- Apple Feedback FB22365722
