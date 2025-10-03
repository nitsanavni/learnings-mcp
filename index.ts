import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { join } from "path";
import { z } from "zod";
import { LearningsModule } from "./src/learnings.js";
import { GitHubRepository } from "./src/GitHubRepository.js";
import { LEARNING_GUIDELINES, LEARNING_TEMPLATE } from "./src/prompts.js";

// Initialize repository and learnings module
const LEARNINGS_DIR = join(import.meta.dir, "learnings");
const repository = new GitHubRepository(LEARNINGS_DIR);
const learnings = new LearningsModule(repository);

// Create the learnings MCP server
const server = new McpServer({
  name: "learnings-mcp-server",
  version: "1.0.0",
});

// Tool: List/search learnings
server.registerTool(
  "list_learnings",
  {
    title: "List Learnings",
    description: "Search and list learnings by topic, tags, or text search",
    inputSchema: {
      topic: z.string().optional().describe("Filter by topic"),
      tags: z.array(z.string()).optional().describe("Filter by tags (must have all)"),
      search: z.string().optional().describe("Text search in title and content"),
    },
  },
  async ({ topic, tags, search }) => {
    try {
      const results = await learnings.list({ topic, tags, search });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No learnings found matching the criteria.",
            },
          ],
        };
      }

      const formatted = results
        .map((r) => `- **${r.filename}**: ${r.title} (topic: ${r.topic})`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} learning(s):\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing learnings: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get learning content
server.registerTool(
  "get_learning",
  {
    title: "Get Learning",
    description: "Fetch the full content of a learning by filename",
    inputSchema: {
      filename: z.string().describe("The filename of the learning (e.g., 'git-rebase.md')"),
    },
  },
  async ({ filename }) => {
    try {
      const learning = await learnings.get(filename);

      const formatted = `# ${learning.metadata.title}

**Topic**: ${learning.metadata.topic}
**Tags**: ${learning.metadata.tags.join(", ") || "none"}
**Created**: ${learning.metadata.created}
**Related**: ${learning.metadata.related.join(", ") || "none"}

---

${learning.content}`;

      return {
        content: [{ type: "text", text: formatted }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading learning: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Add learning
server.registerTool(
  "add_learning",
  {
    title: "Add Learning",
    description: "Create a new learning",
    inputSchema: {
      filename: z
        .string()
        .describe("Filename in format: {context}-{short-title}.md"),
      title: z.string().describe("Short descriptive title"),
      topic: z.string().describe("Main topic/category"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      oneLiner: z.string().describe("One-line description"),
      context: z.string().describe("When/why to use this"),
      examples: z.string().describe("Code snippets and examples"),
      related: z.array(z.string()).optional().describe("Related learning filenames"),
    },
  },
  async ({ filename, title, topic, tags, oneLiner, context, examples, related }) => {
    try {
      const result = await learnings.add({
        filename,
        title,
        topic,
        tags,
        oneLiner,
        context,
        examples,
        related,
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully created learning: ${result.filename}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating learning: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Remove learning
server.registerTool(
  "remove_learning",
  {
    title: "Remove Learning",
    description: "Delete a learning by filename",
    inputSchema: {
      filename: z.string().describe("The filename of the learning to delete"),
    },
  },
  async ({ filename }) => {
    try {
      await learnings.remove(filename);

      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted learning: ${filename}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting learning: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Prompt: Learning guidelines
server.registerPrompt(
  "learning_guidelines",
  {
    title: "Learning Creation Guidelines",
    description: "Guidelines and best practices for creating well-structured learnings",
    argsSchema: {},
  },
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: LEARNING_GUIDELINES,
        },
      },
    ],
  })
);

// Prompt: Learning template
server.registerPrompt(
  "create_learning",
  {
    title: "Create Learning Template",
    description: "Interactive template for creating a new learning",
    argsSchema: {
      title: z.string().optional().describe("Learning title"),
      topic: z.string().optional().describe("Learning topic"),
      context: z.string().optional().describe("Initial context"),
    },
  },
  ({ title, topic, context }) => LEARNING_TEMPLATE({ title, topic, context })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
