---
author: "Sam McLeod"
readingTime: true
categories: [ Tech ]
date: "2015-02-26T00:00:00Z"
aliases:
  - /tech/2015/05/26/xen-orchestra-docker-image/
images: ["backdrop-insidebuilding.jpg"]
featuredImagePreview: backdrop-insidebuilding.jpg
tags:
- tech
- xen
title: Xen Orchestra Docker Image
---

Docker config to setup XO which is a web interface to visualize and administrate your XenServer (or XAPI enabled) hosts

[Github: sammcj/docker-xen-orchestra](https://github.com/sammcj/docker-xen-orchestra)

## Running the app

Updates are pushed to the Docker Hub's automated build service:

* <https://registry.hub.docker.com/u/sammcj/docker-xen-orchestra>


## From Docker Hub

```shell
docker pull sammcj/docker-xen-orchestra
docker run -d -p 8000:80 sammcj/docker-xen-orchestra
```

## Building

```shell
git clone https://github.com/sammcj/docker-xen-orchestra.git
cd docker-xen-orchestra
# Edit whatever config you want to change
docker build -t xen-orchestra .
```

See <https://xen-orchestra.com> for information on Xen Orchestra
