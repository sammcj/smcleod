{{- /* Vimeo as a link in the markdown output format (page.markdown.md) */ -}}
[Vimeo video{{ with .Get "title" }}: {{ . }}{{ end }}](https://vimeo.com/{{ or (.Get "id") (.Get 0) }})
