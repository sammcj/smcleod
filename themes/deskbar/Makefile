HUGO ?= hugo
PORT ?= 1313
OUT := $(CURDIR)/.build/public
# Hugo's default cache dir is outside the repo; keeping it local makes builds work in sandboxes and CI alike
export HUGO_CACHEDIR ?= $(CURDIR)/.build/cache

.PHONY: serve build test unit budget e2e vendor-mermaid clean

serve: ## run the example site with live reload
	cd exampleSite && $(HUGO) server --port $(PORT)

build: ## build the example site into .build/public
	cd exampleSite && $(HUGO) --gc --minify --quiet -d $(OUT)

unit: ## unit tests (node --test, no dependencies)
	node --test 'tests/*.test.mjs'

budget: build ## shell JS + CSS at or under 40KB gzipped, each on-demand bundle at or under 12KB
	node scripts/size-budget.mjs $(OUT)

test: unit budget

# Browser tests. Needs `npm install`. SITE_DIR tests another built site (served by e2e/serve.mjs) and BASE_URL a running
# one; either skips the example build. Set CHROMIUM_PATH to use a browser other than Playwright's own, and SPECS to run
# only some specs (SPECS=e2e/sketch.spec.mjs).
SPECS ?= e2e/*.spec.mjs
e2e: $(if $(BASE_URL)$(SITE_DIR),,build)
	SITE_DIR="$(or $(SITE_DIR),$(OUT))" node --test --test-concurrency=1 $(SPECS)

# Self-hosted Mermaid (see assets/js/deskbar/lazy/mermaid.js). Copies the npm package's minified ESM build, whose
# entry loads only the chunks each diagram type needs. Source maps are left out. Bump MERMAID in lazy/mermaid.js to match.
vendor-mermaid: ## make vendor-mermaid V=12.0.0
	@test -n "$(V)" || { echo 'usage: make vendor-mermaid V=<version>'; exit 2; }
	rm -rf .build/mermaid static/vendor/mermaid-$(V) && mkdir -p .build/mermaid static/vendor/mermaid-$(V)/chunks
	cd .build/mermaid && npm pack --silent mermaid@$(V) && tar xzf mermaid-$(V).tgz
	cp .build/mermaid/package/dist/mermaid.esm.min.mjs .build/mermaid/package/LICENSE static/vendor/mermaid-$(V)/
	mkdir -p static/vendor/mermaid-$(V)/chunks/mermaid.esm.min
	cp .build/mermaid/package/dist/chunks/mermaid.esm.min/*.mjs static/vendor/mermaid-$(V)/chunks/mermaid.esm.min/

clean:
	rm -rf .build
