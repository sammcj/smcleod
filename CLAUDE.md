# Project Instructions for Coding Agents

## Theme

Important: NEVER make changes to files in the themes/ directory, these are git submodules / clones of upstream code.

## Agentic Coding Tools Comparison Table

### Data Updates
To update the comparison table data, edit:
- **File**: `data/agentic_tools_comparison.yml`
- **Structure**: Tools are defined at the top with `header_highlight` values, followed by categories with features
- **Tool Headers**: Set `header_highlight: 0-5` for each tool to colour the header cell
- **Cell Highlights**: Add `{tool_id}_highlight: 0-5` to apply colour coding to individual cells:
  - 0 = Light blue (positive/meets requirements)
  - 1 = Light yellow (enterprise required)
  - 2-5 = Increasing levels of concern (light orange to red)

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
