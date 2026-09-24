{{- /* A wide image, as an image with an absolute URL, in a post's markdown output (the theme's page.markdown.md, for "Copy as markdown") */ -}}
![{{ .Get "alt" }}]({{ with .Page.Resources.GetMatch (.Get "src") }}{{ .Permalink }}{{ else }}{{ .Get "src" | absURL }}{{ end }}){{ with .Get "caption" }}{{ "\n\n" }}_{{ . }}_{{ end }}
