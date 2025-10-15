# Project Instructions for Coding Agents

## Theme

Important: NEVER make changes to files in the themes/ directory, these are git submodules / clones of upstream code.

## Agentic Coding Tools Comparison Table

### Data Updates
To update the comparison table data, edit:
- **File**: `data/agentic_tools_comparison.yml`
- **Structure**: Tools are defined at the top, followed by categories with features
- **Highlights**: Add `{tool_id}_highlight: 1-5` to apply colour coding (1=enterprise required, 5=major concern)

### Styling Changes
If table styling needs adjustment:
- **CSS File**: `assets/css/agentic-tools-table.css`
- **Configurable Options**:
  - Cell max width: `--table-cell-max-width` variable in `:root`
  - Category row colour: `.category-row` and `.category-name`
  - Feature name column colour: `.feature-name`
  - Highlight colours: `--highlight-1` through `--highlight-5` in `:root`

### Template Files
- **Shortcode**: `layouts/shortcodes/comparison-table.html` (calls partial)
- **Partial**: `layouts/partials/comparison-table.html` (renders table from data)
- **Page**: `content/agentic-coding-tools.md` (uses the shortcode)
