{{- /* A page's markdown source (the "markdown" output format, hugo.toml), for "Copy as markdown" in the reader.
       Shortcodes are rendered, since a raw call such as ref means nothing outside Hugo; a shortcode whose HTML reads
       badly as markdown can have a <name>.markdown.md variant. Relative link and image targets, in markdown or HTML,
       become absolute, so they still work once the text is pasted elsewhere. The terminator is captured because RE2
       has no lookahead: without it "https:" would look like a relative path. */ -}}
{{- $md := .RenderShortcodes | strings.TrimSpace -}}
{{- /* Author notes in HTML comments stay out. A comment inside fenced code is part of its example, so only the text
       between fences (the even parts when split on ```) loses them. */ -}}
{{- $parts := slice -}}
{{- range $i, $p := split $md "```" -}}
  {{- if modBool $i 2 }}{{ $p = replaceRE `(?s)<!--.*?-->\n?` "" $p }}{{ end -}}
  {{- $parts = $parts | append $p -}}
{{- end -}}
{{- $md = delimit $parts "```" -}}
{{- $at := `((?:\]\(|(?:src|href)="))` -}}
{{- $md = replaceRE (print $at `/([^/"\s)][^"\s)]*)`) (print "${1}" (strings.TrimSuffix "/" site.BaseURL) "/${2}") $md -}}
{{- $md = replaceRE (print $at `([^/#"\s):?][^"\s):]*)([)"\s])`) (print "${1}" .Permalink "${2}${3}") $md -}}
# {{ .Title }}

{{ if not .Date.IsZero }}{{ .Date.Format "2 January 2006" }}, {{ end }}{{ .Permalink }}

{{ $md }}
