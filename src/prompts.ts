export const LEARNING_GUIDELINES = `# Learning Creation Guidelines

## What Makes a Good Learning?

A good learning is a **shorthand for repeating a previous pattern, success, approach, or task**. It should help you quickly recall and apply knowledge you've gained from experience.

## Key Principles

1. **Atomic**: Each learning should stand on its own and focus on ONE thing
2. **Contextual**: Include when and why you'd use this approach
3. **Concrete**: Provide specific examples and code snippets
4. **Actionable**: Should help you take action in similar situations

## Structure

### Filename
Use the format: \`{context}-{short-title}.md\`

Examples:
- \`git-rebase-interactive-cleanup.md\`
- \`typescript-zod-schema-inference.md\`
- \`react-useeffect-cleanup-pattern.md\`

### Front Matter (Required)
\`\`\`yaml
---
title: Short descriptive title
topic: main-topic
tags: [tag1, tag2, tag3]
created: YYYY-MM-DD
related: [other-learning.md, another-learning.md]
---
\`\`\`

### Content Structure

\`\`\`markdown
# Title

One-liner description of what this learning is about.

## Context

Describe when and why you'd use this. What problem does it solve? What situation calls for this approach?

## Examples

Provide concrete code snippets and real-world examples that demonstrate the learning.

\`\`\`language
// Code example here
\`\`\`

Explain what the code does and why it matters.

## See Also

- [Related Learning 1](./related-learning-1.md)
- [Related Learning 2](./related-learning-2.md)
\`\`\`

## Tips

- **Keep it focused**: If you're trying to cover multiple things, split into multiple learnings
- **Add context liberally**: Future you will thank present you for explaining "why"
- **Link related learnings**: Build a knowledge graph by connecting related concepts
- **Use real examples**: Prefer concrete code from actual work over abstract examples
- **Date it**: The \`created\` date helps you track when you learned something
`;

export const LEARNING_TEMPLATE = (params: {
  title?: string;
  topic?: string;
  context?: string;
}) => ({
  messages: [
    {
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `I want to create a new learning${params.title ? ` about: ${params.title}` : ""}${params.topic ? ` (topic: ${params.topic})` : ""}.

${LEARNING_GUIDELINES}

${params.context ? `Here's some context about what I want to capture:\n${params.context}\n\n` : ""}Please help me structure this learning according to the guidelines above. Ask me questions to fill in any missing parts (context, examples, related learnings, etc.).`,
      },
    },
  ],
});
