# HELP
# This will output the help for each task
# thanks to https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
.PHONY: help

help: ## This help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

# Variables
HUGO ?= hugo
HUGO_PORT ?= 1313
PUBLIC ?= public

# Tasks

.PHONY: serve run site-build check test e2e thumbs
serve: ## Run the Hugo dev server
	$(HUGO) server --port $(HUGO_PORT)

run: serve ## Alias for serve

site-build: ## Build the site into $(PUBLIC)
	$(HUGO) --gc --minify -d "$(PUBLIC)"

check: ## Check the built site: posts, aliases, RSS, internal links, key pages (CHECK_ARGS=--strict ignores the known broken links)
	HUGO_BIN="$(HUGO)" node scripts/check-site.mjs $(CHECK_ARGS) "$(PUBLIC)"

test: ## Run the site's unit tests (tests/*.test.mjs)
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
