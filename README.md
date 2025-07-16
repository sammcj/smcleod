# smcleod.net

Source repository for my personal website.

## Usage

Visit <https://smcleod.net>

## Contributing

Feel free to raise a PR or [create an issue](https://github.com/sammcj/smcleod/issues/new/choose) if you find any problems or have a suggestion.

## Hugo Shortcodes

See [SHORTCODES.md](SHORTCODES.md).

## Wide Images

To display images at 80% of the browser width (breaking out of the normal content width), use the `wide-image` shortcode:

```markdown
{{< wide-image src="image.png" alt="Description" caption="Optional caption" >}}
```

**Parameters:**
- `src` (required): Path to the image file
- `alt` (optional): Alt text for accessibility
- `caption` (optional): Caption text displayed below the image

**Legacy support:** Images with `?c=wide` or `#wide` URL parameters will still work for backwards compatibility.

<a rel="me" href="https://aus.social/@s_mcleod">Mastodon</a>

## License

- Copyright © 2024 Sam McLeod
- This project is open source and licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
