module github.com/sammcj/smcleod/deskbar/exampleSite

go 1.22

require (
	github.com/KKKZOZ/hugo-admonitions v0.12.0
	github.com/sammcj/smcleod/deskbar v0.0.0
)

replace github.com/sammcj/smcleod/deskbar => ../

// the site's hugo-admonitions submodule, so the example builds offline without Go
replace github.com/KKKZOZ/hugo-admonitions => ../../github.com/KKKZOZ/hugo-admonitions
