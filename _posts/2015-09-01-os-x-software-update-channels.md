---
title: OS X Software Update Channels For Betas
date: 2015-09-01
categories: tech macos
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
show_avatar : true
read_time : 22
feature_image: backdrop-austria
show_related_posts: true
---

### Set update channel to receive developer beta update

{% highlight bash %}
sudo softwareupdate --set-catalog https://swscan.apple.com/content/catalogs/others/index-10.11seed-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
{% endhighlight %}

### Set update channel to receive public beta update

{% highlight bash %}
sudo softwareupdate --set-catalog https://swscan.apple.com/content/catalogs/others/index-10.11beta-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
{% endhighlight %}

### List available updates

{% highlight bash %}
{% endhighlight %}
sudo softwareupdate --list

### Set update channel to receive default, stable updates

{% highlight bash %}
sudo softwareupdate --clear-catalog
{% endhighlight %}

### Show current settings

{% highlight bash %}
defaults read /Library/Preferences/com.apple.SoftwareUpdate.plist
{% endhighlight %}

### Write setting manually

{% highlight bash %}
defaults write /Library/Preferences/com.apple.SoftwareUpdate CatalogURL https://swscan.apple.com/content/catalogs/others/index-10.11beta-10.11-10.10-10.9-mountainlion-lion-snowleopard-leopard.merged-1.sucatalog.gz
{% endhighlight %}
