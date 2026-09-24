{{- /* A bibliography entry, as a footnote, in a post's markdown output (the theme's page.markdown.md, for "Copy as markdown") */ -}}
[^{{ .Get 0 }}]: {{ .Inner | strings.TrimSpace | replaceRE `\s*\n\s*` " " }}
