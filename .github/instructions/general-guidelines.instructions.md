# General PR Review Guidelines

## Review Priorities

1. **Australian English spelling**
2. **No AI clichés** - Flag overused AI phrases and marketing language
3. **Content quality** - Natural writing, concrete examples

## What to Focus On

### High Priority Issues
- Incorrect spelling (non-Australian English)
- Security vulnerabilities
- Modifications to theme files
- Hardcoded secrets or credentials
- Breaking Hugo build configuration
- Deprecated Sass syntax

### Medium Priority Issues
- AI clichés and marketing language

## Review Tone

- Be constructive, concise and specific
- Suggest concrete improvements
- Explain "why" for non-obvious issues
- **Don't nitpick trivial matters**

## What NOT to Flag

- Personal writing style (unless AI clichés)
- Preference-based code organisation
- Minor formatting inconsistencies
- Properly justified design decisions

## Common Patterns to Check

### In Code Changes
- [ ] Australian English in all comments and strings
- [ ] Proper Hugo asset pipeline usage
- [ ] Modern Sass syntax (if applicable)

### In Content Changes
- [ ] Australian English spelling throughout
- [ ] No AI clichés or marketing language
- [ ] Proper front matter

### In Configuration Changes
- [ ] Valid YAML/TOML syntax
