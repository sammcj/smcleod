{{- /* YouTube as a link in the markdown output format (page.markdown.md) */ -}}
[YouTube video{{ with .Get "title" }}: {{ . }}{{ end }}](https://www.youtube.com/watch?v={{ or (.Get "id") (.Get 0) }})
