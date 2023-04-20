#!/usr/bin/env bash

git checkout main
git pull
git checkout -b "update-theme-$(date +%Y%m%d%H%M%S)"
git rm -rf themes/DoIt

git clone --depth=1 https://github.com/HEIGE-PCloud/DoIt.git themes/DoIt

hugo
