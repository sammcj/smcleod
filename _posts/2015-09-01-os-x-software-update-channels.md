---
title: OS X Software Update Channels For Betas
date: 2015-09-01
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-austria

---

### Set update channel to receive developer beta update

```
sudo softwareupdate --set-catalog https://swscan.apple.com/content/catalogs/others/index-10.11seed-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
```

### Set update channel to receive public beta update

```
sudo softwareupdate --set-catalog https://swscan.apple.com/content/catalogs/others/index-10.11beta-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
```

### List available updates

```
```
sudo softwareupdate --list

### Set update channel to receive default, stable updates

```
sudo softwareupdate --clear-catalog
```

### Show current settings

```
defaults read /Library/Preferences/com.apple.SoftwareUpdate.plist
```

### Write setting manually

```
defaults write /Library/Preferences/com.apple.SoftwareUpdate CatalogURL https://swscan.apple.com/content/catalogs/others/index-10.11beta-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
```
