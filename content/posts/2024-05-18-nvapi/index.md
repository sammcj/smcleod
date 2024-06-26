---
title: "NVApi - Nvidia GPU Monitoring API"
date: 2024-05-18T11:30:03+00:00
# weight: 1
# aliases: ["/first"]
tags: ["AI", "Nvidia", "GPU", "Monitoring", "API", "Go", "Golang"]
author: "Sam McLeod"
showToc: true
TocOpen: false
draft: false
hidemeta: false
comments: false
description: "Nvidia GPU Monitoring API"
# canonicalURL: "https://canonical.url/to/page"
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
cover:
    image: "https://github.com/sammcj/NVApi/blob/main/screenshots/home-assistant-integration-2.png?raw=true" # image path/url
    alt: "NVApi integrated with Home Assistant" # alt text
    caption: "NVApi integrated with Home Assistant" # display caption under cover
    relative: false # when using page bundles set this to true
    hidden: true # only hide on current single page
---

NVApi is a small application I've written for monitoring and presenting utilisation metrics from Nvidia GPUs.

This can be used to monitor GPU memory, temperature, power usage, and utilisation of GPUs in a system and can easily be integrated into tools such as HomeAssistant or Prometheus.

The package uses the Nvidia Management Library (NVML) and provides a simple API for monitoring Nvidia GPUs along with a basic GUI client.

- [NVApi on Github](https://github.com/sammcj/nvapi)

![](https://github.com/sammcj/NVApi/blob/main/screenshots/home-assistant-integration-2.png?raw=true)

<!--more-->

## Usage

### Docker Container

_Note: The Dockerfile is a work in progress, the current container image is bloated and not optimised for size yet._

The application can be run as a container:

```shell
docker build -t nvapi:latest .
```

Or using docker-compose see [docker-compose.yml](https://github.com/sammcj/NVApi/blob/main/docker-compose.yml) for an example configuration.

### Local Installation

To run the API, use the following command:

```shell
go run main.go -port 9999 -rate 3
```

This will start the API on port 9999 with a rate limit of 1 request per second.

## API Endpoints

### `/`

Returns the current GPU utilisation information in JSON format.

## Query Parameters

- `port`: The port number to listen on (default: 9999)
- `rate`: The minimum number of seconds between requests (default: 3)

## Example Response

```shell
curl http://localhost:9999/gpu
```

```json
[{
  "gpu_utilisation": 0,
  "memory_utilisation": 0,
  "power_watts": 23,
  "memory_total_gb": 24,
  "memory_used_gb": 9.77,
  "memory_free_gb": 14.23,
  "memory_usage_percent": 41,
  "temperature": 35,
  "fan_speed": 0,
  "processes": [{
    "Pid": 2345831,
    "UsedGpuMemoryMb": 9678,
    "Name": "/tmp/ollama630272566/runners/cuda_v12/ollama_llama_server",
    "Arguments": ["--model", "/home/llm/.ollama/models/blobs/sha256-583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958", "--ctx-size", "12288", "--batch-size", "512", "--embedding", "--log-disable", "--n-gpu-layers", "33", "--flash-attn", "--parallel", "6", "--port", "42161"]
 }]
}]
```

![](https://github.com/sammcj/NVApi/blob/main/screenshots/json_response.png?raw=true)

### `/svg`

Returns a (very) basic SVG image showing the current GPU utilisation as a bar.

### Home Assistant Integration

Example of using the API to integrate with Home Assistant:

```yaml
sensors:

- platform: rest
  name: "GPU Utilisation"
  resource: http://localhost:9999
  unit_of_measurement: "%"
  unique_id: gpu_0
  scan_interval: 30
  json_attributes:
    - gpu_utilisation
    - memory_utilisation
    - memory_used_gb
    - memory_free_gb
    - power_watts
    - temperature
    - fan_speed
  value_template: '{{ value_json[0].gpu_utilisation }}'

- platform: rest
  name: "GPU Memory Utilisation"
  resource: http://localhost:9999
  unit_of_measurement: "%"
  unique_id: gpu_0_memory_utilisation
  scan_interval: 30
  json_attributes:
    - memory_utilisation
  value_template: '{{ value_json[0].memory_utilisation }}'

- platform: rest
  name: "GPU Memory Used"
  resource: http://localhost:9999
  unit_of_measurement: "GB"
  unique_id: gpu_0_memory_used_gb
  scan_interval: 30
  json_attributes:
    - memory_used_gb
  value_template: '{{ value_json[0].memory_used_gb }}'

- platform: rest
  name: "GPU Memory Free"
  resource: http://localhost:9999
  unit_of_measurement: "GB"
  unique_id: gpu_0_memory_free_gb
  scan_interval: 30
  json_attributes:
    - memory_free_gb
  value_template: '{{ value_json[0].memory_free_gb }}'

- platform: rest
  name: "GPU Temperature"
  resource: http://localhost:9999
  unit_of_measurement: "°C"
  unique_id: gpu_0_temperature
  scan_interval: 30
  json_attributes:
    - temperature
  value_template: '{{ value_json[0].temperature }}'

- platform: rest
  name: "GPU Fan Speed"
  resource: http://localhost:9999
  unit_of_measurement: "RPM"
  unique_id: gpu_0_fan_speed
  scan_interval: 30
  json_attributes:
    - fan_speed
  value_template: '{{ value_json[0].fan_speed }}'

- platform: rest
  name: "GPU Power"
  resource: http://localhost:9999
  unit_of_measurement: "W"
  unique_id: gpu_0_power
  scan_interval: 30
  json_attributes:
    - power_watts
  value_template: '{{ value_json[0].power_watts }}'
```

## NVApi-Tray GUI

A simple GUI application that displays the GPU utilisation information from the API.

![](https://github.com/sammcj/NVApi/blob/main/screenshots/NVApiGUI.png?raw=true)

This is a work in progress but can be built from the `NVApi-GUI` directory.

```shell
cd NVApi-GUI
go build
```
