#!/usr/bin/env bash

# Assumes you've built the container image with:
# docker build -t sammcj/smcleod .

docker run -it --rm --init -p 3000:3000 sammcj/smcleod
