# Technical Review Guidelines for PR Reviews

## Hugo-Specific Checks

### Theme Files
- **NEVER modify files in `themes/` directory** - these are git submodules/upstream code
- Theme customisations must go in project-level overrides or custom CSS
- Flag any changes to theme files immediately

### Asset Pipeline
- CSS files should use Hugo's asset pipeline with minification
- Font files must be self-hosted in `/static/fonts/`
- No CDN dependencies for fonts
- Verify proper Hugo fingerprinting for cache busting

### Configuration
- Check `hugo.yaml` for correct syntax and indentation
- Ensure Hugo Extended is specified where needed

## SCSS/CSS

### Dart Sass Compliance
- Use modern module system: `@use` and `@forward`
- Avoid deprecated `@import`
- Use namespaced functions: `map.get()`, `list.join()`, `map.merge()`
- No global built-in functions (deprecated in Dart Sass 3.0)

### Font Configuration
- Verify font files are in `/static/fonts/`
- Check @font-face declarations use correct paths
- Confirm font-display: swap for performance
- Variable fonts preferred over multiple weight files
