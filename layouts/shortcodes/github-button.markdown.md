{{- /* A GitHub button, as a link in a post's markdown output (the theme's page.markdown.md, for "Copy as markdown") */ -}}
[{{ .Get "user" }}/{{ .Get "repo" }} on GitHub](https://github.com/{{ .Get "user" }}/{{ .Get "repo" }})
