FROM lipanski/docker-static-website:latest

LABEL maintainer="Sam McLeod"
LABEL homepage="https://smcleod.net"
LABEL repository="https://github.com/sammcj/smcleod"
LABEL description="Minimal container that serves up the static site smcleod.net"

# Copy your static files
COPY public/ .
