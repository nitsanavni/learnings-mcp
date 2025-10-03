# Learnings MCP - Implementation Plan

## Overview
MCP server for managing personal learnings stored as markdown files in this repository.

## Phase 1: MCP Server (Current)

### Tools
- `list_learnings` - Search/filter learnings
  - Optional params: `topic`, `search` (text in body), `tags`
  - Returns: list of filenames + titles (lightweight)
- `get_learning` - Fetch full learning content by filename
- `add_learning` - Create new learning
  - Params: title, topic, tags, context, examples, related
- `remove_learning` - Delete a learning by filename

### Prompts
- Learning creation guidelines (atomic, well-structured, context-title naming)
- Interactive learning construction template

### Storage Structure
- Each learning = separate markdown file
- Naming: `{context}-{short-title}.md`
- Location: `./learnings/` directory
- Front matter:
  ```yaml
  ---
  title: Short descriptive title
  topic: main-topic
  tags: [tag1, tag2]
  created: YYYY-MM-DD
  related: [other-file-1.md, other-file-2.md]
  ---
  ```
- Content structure:
  ```markdown
  # Title

  One-liner description

  ## Context
  When/why you'd use this

  ## Examples
  Code snippets and concrete examples

  ## See Also
  - [Related Learning 1](./related-1.md)
  ```

### What Makes a Good Learning?
- Shorthand for repeating previous patterns/successes/approaches
- Atomic - stands on its own, about one thing
- Includes context for when to apply it
- Has concrete examples

## Phase 2: CLI Interface (Future)
- Interactive CLI for managing learnings database
- Commands: add, list, search, edit, remove
- Could integrate with `bun` for fast execution
- TBD: Detailed design and implementation
