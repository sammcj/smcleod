---
title: Xen Orchestra Docker Image
layout: post
categories: []
date:   2015-02-26 22:37:00
---

Docker config to setup XO which is a web interface to visualize and administrate your XenServer (or XAPI enabled) hosts

[Github: sammcj/docker-xen-orchestra](https://github.com/sammcj/docker-xen-orchestra)

## Running the app

Updates are pushed to the Docker Hub's automated build service:

* https://registry.hub.docker.com/u/sammcj/docker-xen-orchestra
<!--more-->

## From Docker Hub

{% highlight bash %}
docker pull sammcj/docker-xen-orchestra
docker run -d -p 8000:80 sammcj/docker-xen-orchestra
{% endhighlight %}

## Building

{% highlight bash %}
git clone https://github.com/sammcj/docker-xen-orchestra.git
cd docker-xen-orchestra
# Edit whatever config you want to change
docker build -t xen-orchestra .
{% endhighlight %}

See https://xen-orchestra.com for information on Xen Orchestra