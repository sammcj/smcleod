{{- /* A gist as a link in the markdown output format (page.markdown.md): {{< gist user id [file] >}} */ -}}
[Gist{{ with .Get 2 }}: {{ . }}{{ end }}](https://gist.github.com/{{ .Get 0 }}/{{ .Get 1 }})
