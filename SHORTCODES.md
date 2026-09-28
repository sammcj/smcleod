# Sam's Hugo Shortcodes

Templates are in [layouts/shortcodes](layouts/shortcodes). Shortcodes with a `.markdown.md` twin also render into the site's markdown output.

## General

Highlighted text (overrides Hugo's built-in `highlight`; use fenced code blocks for code):

```hugo
{{< highlight color="#c5ecff" >}}some **words**{{< /highlight >}}
```

Static GitHub link styled as a button (no live counts). `button` is one of follow, sponsor, watch, star, fork, template, issue, download:

```hugo
{{< github-button button="star" user="sammcj" repo="zsh-bootstrap" count="true" >}}
```

GitHub gist, rendered in its own frame (optional third argument picks a file):

```hugo
{{< gist sammcj 45a32a7df6ea5b4efec7a7dd3bf2fc95 >}}
```

YouTube playlist:

```hugo
{{< youtubepl id="PLt6FXz8iff5hdyNdCTik8HqNhm5y9mwxH" >}}
```

Wide image from the page bundle, and wide content (tables) that break out of the post width:

```hugo
{{< wide-image src="diagram.png" alt="Alt text" caption="Optional caption" >}}
{{< wide-table >}}
| a | b |
|---|---|
{{< /wide-table >}}
```

Text that types itself out when scrolled into view (readable without JS):

```hugo
{{< typeit >}}A quote{{< /typeit >}}
```

Inline page script, re-run when the page is routed into a window:

```hugo
{{< script >}}console.log('hi'){{< /script >}}
```

## Citations

`cite-inline` adds a numbered reference with a hover tooltip. `bibliography` wraps the `bibentry` list and loads the citation styles.

```hugo
Some claim {{< cite-inline "Benjamin1969" >}}.

{{< bibliography >}}
{{< bibentry "Benjamin1969" >}}Benjamin, W. (1969). ...{{< /bibentry >}}
{{< /bibliography >}}
```

## Page-specific

These render one page's data or app and take no content:

- `comparison-table`, `comparison-table-legend` - agentic coding tools table (see CLAUDE.md)
- `skills-matrix`
- `contact` - contact form
- `heatmap` - AI tool ratings
- `vram-calculator`
- `quantisationDashboard`
- `perplexity-chart`
- `admeds`
