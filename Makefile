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
HUGO ?= hugo
HUGO_PORT ?= 1313
PUBLIC ?= public

# Tasks

.PHONY: serve site-build check test e2e thumbs
serve: ## Run the Hugo dev server
	$(HUGO) server --port $(HUGO_PORT)

site-build: ## Build the site into $(PUBLIC)
	$(HUGO) --gc --minify -d "$(PUBLIC)"

check: ## Check the built site: posts, aliases, RSS, internal links, key pages (CHECK_ARGS=--strict ignores the known broken links)
	HUGO_BIN="$(HUGO)" node scripts/check-site.mjs $(CHECK_ARGS) "$(PUBLIC)"

test: ## Run the unit tests (vRAM estimator)
	node --test 'tests/*.test.mjs'

# Real pages for the theme specs that otherwise use example-site fixtures. POST_PATH, MD_PAGE and GALLERY_POST stay
# unset: those specs assert on example content (heading ids, a footnote count, a Go snippet, a two-photo gallery) that no
# real page has, so they skip.
e2e: ## Run the theme's browser and accessibility tests against the site built in $(PUBLIC) (local only, too slow for CI; CHROMIUM_PATH optional)
	$(MAKE) -C themes/deskbar e2e SITE_DIR="$(abspath $(PUBLIC))" \
		ALIAS_PATH=/tech/2015/04/15/talk-high-perf-sds-ictalk/ \
		MERMAID_PAGE=/2025/04/getting-started-with-agentic-systems-developer-learning-paths/ \
		PHOTOS_POST=/2020/11/ferrari-f12-berlinetta/ \
		SCRIPT_PAGE=/admeds/ \
		SCRIPT_SELECTOR=.admeds-legend-title

thumbs: ## Render bespoke post thumbnails from assets/thumbnails-src (THUMBS=<bundle> for one; CHROMIUM_PATH optional; uses the theme's Playwright and pngquant)
	node scripts/render-thumbs.mjs $(THUMBS)

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
