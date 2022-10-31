---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-09-01T00:00:00Z"
aliases:
  - /tech/2015/09/01/os-x-software-update-channels/
image: rishi-deep-424424.jpg
featuredImagePreview: rishi-deep-424424.jpg
tags:
- tech
title: OS X Software Update Channels For Betas
---


### Set update channel to receive developer beta update

```shell
sudo softwareupdate --set-catalog https://swscan.apple.com/content/catalogs/others/index-10.11seed-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
```

### Set update channel to receive public beta update

```shell
sudo softwareupdate --set-catalog https://swscan.apple.com/content/catalogs/others/index-10.11beta-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
```

### List available updates

```shell
sudo softwareupdate --list
```

### Set update channel to receive default, stable updates

```shell
sudo softwareupdate --clear-catalog
```

### Show current settings

```shell
defaults read /Library/Preferences/com.apple.SoftwareUpdate.plist
```

### Write setting manually

```shell
defaults write /Library/Preferences/com.apple.SoftwareUpdate CatalogURL https://swscan.apple.com/content/catalogs/others/index-10.11beta-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
```
