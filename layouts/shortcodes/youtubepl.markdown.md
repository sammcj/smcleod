{{- /* A YouTube playlist, as a link in a post's markdown output (the theme's page.markdown.md, for "Copy as markdown") */ -}}
[YouTube playlist](https://www.youtube.com/playlist?list={{ or (.Get "id") (.Get 0) }})
