---
title: Effective Git Commit Messages
topic: git
tags: [git, workflow, best-practices]
created: 2025-10-03
related: []
---

# Effective Git Commit Messages

Write clear, actionable commit messages that explain the why, not just the what.

## Context

Good commit messages are crucial for:
- Understanding project history without reading code
- Helping teammates review changes quickly
- Making git bisect and git blame more useful
- Creating meaningful changelogs

Use this pattern when making any commit to maintain a professional, searchable history.

## Examples

### Structure

```
<type>: <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Formatting, missing semicolons, etc.
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **test**: Adding missing tests
- **chore**: Updating build tasks, package manager configs, etc.

### Example

```
feat: add user authentication with OAuth2

Implement OAuth2 flow for Google and GitHub providers.
This allows users to sign in without creating a password,
improving security and user experience.

Closes #123
```

### Quick Tips
- Keep subject line under 50 characters
- Capitalize subject line
- Don't end subject with a period
- Use imperative mood ("add" not "added")
- Wrap body at 72 characters
- Explain what and why, not how