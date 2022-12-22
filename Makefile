# HELP
# This will output the help for each task
# thanks to https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
.PHONY: help

help: ## This help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

# Variables
VERSION ?= $(shell git describe --tags --always --dirty)
PORT ?= 3000
REGISTRY ?= ghcr.io
DOCKER_REPO ?= $(REGISTRY)/sammcj/smcleod
USERNAME ?= sammcj
TOKEN ?= $(shell echo $$GITHUB_TOKEN)

# Tasks

hugo: ## Run hugo
	@echo 'running hugo'
	hugo serve --disableFastRender --buildDrafts

lint-docker: ## Lint the Dockerfile
	@echo 'linting Dockerfile'
	docker run --rm -i hadolint/hadolint < Dockerfile

build: ## Build the container
	@echo 'building $(DOCKER_REPO)'
	docker build -t $(DOCKER_REPO) .

build-nc: ## Build the container without caching
	@echo 'building $(DOCKER_REPO) without caching'
	docker build --no-cache -t $(DOCKER_REPO) .

tag-latest: ## Tag the container
	@echo 'tagging $(DOCKER_REPO) as latest'
	docker tag $(DOCKER_REPO) $(DOCKER_REPO):latest

tag-version: ## Tag the container
	@echo 'tagging $(DOCKER_REPO) as $(VERSION)'
	docker tag $(DOCKER_REPO) $(DOCKER_REPO):$(VERSION)

run: ## Run the container
	@echo 'running $(DOCKER_REPO), browse to http://localhost:$(PORT)'
	docker run -it --rm --init -p $(PORT):$(PORT) $(DOCKER_REPO)

stop: ## Stop and remove a running container
	@echo 'stopping $(DOCKER_REPO)'
	docker stop $(DOCKER_REPO)

login: ## Login to the registry
	@echo 'login to $(REGISTRY)'
	echo $(TOKEN) | docker login ghcr.io -u $(USERNAME) --password-stdin

publish-latest: tag-latest ## Tag the image with latest and push to the registry
	@echo 'publish latest to $(DOCKER_REPO) on $(REGISTRY)'
	docker push $(DOCKER_REPO):latest

publish-version: tag-version ## Tag the image with the version and push to the registry
	@echo 'publish $(VERSION) to $(DOCKER_REPO) on $(REGISTRY)'
	docker push $(DOCKER_REPO):$(VERSION)

# Aliases
build-run: build run
build-tag-publish-latest: build tag-latest publish-latest
tag-version-latest: tag-version tag-latest
publish: publish-latest publish-version
ci: login build-nc publish
run: hugo
push: publish
