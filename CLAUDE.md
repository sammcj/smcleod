# Project Instructions for Coding Agents

- NEVER make changes to files in the themes/ directory, these are git submodules / clones of upstream code.
- NEVER commit or push a git repo unless the user has explicitly requested you to do so.
- In markdown content always use - for lists, _underscores_ and **bold**
- If you are asked to review the users content, as well as the usual Australian English spelling and grammar, you should check the clarity of prose, ensure there's no fluff, filler, empty verbiage, buzzwords, hype or marketing speak, that the content is clear, concise and to the point as well as being factually accurate and well structured.

---

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

### Cell Values with URLs and Tooltips
Cell values support three formats:

1. **Simple text** (backward compatible):
   ```yaml
   tool_name: Simple text value
   ```

2. **Text with direct URL** (clicking opens link in new tab):
   ```yaml
   tool_name:
     text: Display text
     url: https://example.com
   ```

3. **Text with tooltip** (hover to see additional info):
   ```yaml
   tool_name:
     text: Display text
     tooltip: "Additional information shown on hover"
   ```

4. **Text with tooltip containing URLs** (hover shows popup with clickable links):
   ```yaml
   tool_name:
     text: Display text
     tooltip: "More info at https://docs.example.com and https://github.com/example"
   ```

5. **Combined URL and tooltip** (cell is clickable AND shows tooltip on hover):
   ```yaml
   tool_name:
     text: Display text
     url: https://example.com
     tooltip: "Click to visit. See also https://docs.example.com"
   ```

URLs in tooltips are automatically detected and made clickable.

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
