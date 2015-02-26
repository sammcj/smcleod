---
layout: post
title: Xen Orchestra Docker Image
categories: []
tags: [xenserver,docker,github]
published: True
excerpt_separator: <!--more-->
---

### Docker config to setup XO which is a web interface to visualize and administrate your XenServer (or XAPI enabled) hosts

[Github: sammcj/docker-xen-orchestra](https://github.com/sammcj/docker-xen-orchestra)

![main_view](https://cloud.githubusercontent.com/assets/862951/6341155/b4d5b9da-bc1b-11e4-8352-a1688c571e5b.png)

## Running the app

Updates are pushed to the Docker Hub's automated build service:

* https://registry.hub.docker.com/u/sammcj/docker-xen-orchestra

#### From Docker Hub

```
docker pull sammcj/docker-xen-orchestra
docker run -d -p 8000:80 sammcj/docker-xen-orchestra
```

<!--more-->

### Building

```
git clone https://github.com/sammcj/docker-xen-orchestra.git
cd docker-xen-orchestra
# Edit whatever config you want to change
docker build -t xen-orchestra .
```

See https://xen-orchestra.com for information on Xen Orchestra
