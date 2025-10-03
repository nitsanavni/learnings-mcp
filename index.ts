#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";
import { z } from "zod";
import { LearningsModule } from "./src/learnings.js";
import { GitHubRepository } from "./src/GitHubRepository.js";
import { FileSystemRepository } from "./src/FileSystemRepository.js";
import { LEARNING_GUIDELINES, LEARNING_TEMPLATE } from "./src/prompts.js";
import { loadConfig } from "./src/config.js";

// Parse CLI arguments
program
  .name("learnings-mcp-server")
  .description("MCP server for managing personal learnings")
  .option("--repository <path-or-url>", "Repository path or GitHub URL for storing learnings")
  .option("--clone-location <path>", "Where to clone remote repositories (default: ~/.learnings/<repo-name>)")
  .parse();

const options = program.opts();

// Load and validate configuration
const config = loadConfig({
  repository: options.repository,
  cloneLocation: options.cloneLocation,
});

// Initialize repository and learnings module
const repository = config.isGitRepo
  ? new GitHubRepository(config.learningsPath)
  : new FileSystemRepository(config.learningsPath);
const learnings = new LearningsModule(repository);

// Get metadata for dynamic descriptions
const metadata = await learnings.getMetadata();
const topicsPreview = metadata.topics.slice(0, 5).join(", ");
const tagsPreview = metadata.tags.slice(0, 8).join(", ");

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
    description: `Search and list learnings by topic, tags, or text search. Available topics: ${topicsPreview}${metadata.topics.length > 5 ? "..." : ""}. Available tags: ${tagsPreview}${metadata.tags.length > 8 ? "..." : ""}.`,
    inputSchema: {
      topic: z.string().optional().describe("Filter by topic"),
      tags: z.array(z.string()).optional().describe("Filter by tags (must have all)"),
      search: z.string().optional().describe("Text search in title and content"),
      limit: z.number().optional().default(6).describe("Maximum number of results to return (default: 6)"),
    },
  },
  async ({ topic, tags, search, limit = 6 }) => {
    try {
      const [results, metadata] = await Promise.all([
        learnings.list({ topic, tags, search }),
        learnings.getMetadata(),
      ]);

      const truncated = results.length > limit;
      const displayResults = results.slice(0, limit);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No learnings found matching the criteria.\n\n**Available topics**: ${metadata.topics.join(", ") || "none"}\n**Available tags**: ${metadata.tags.join(", ") || "none"}`,
            },
          ],
        };
      }

      const formatted = displayResults
        .map((r) => `- **${r.filename}**: ${r.title} (topic: ${r.topic})`)
        .join("\n");

      const metadataSection = `**Available topics**: ${metadata.topics.join(", ") || "none"}\n**Available tags**: ${metadata.tags.join(", ") || "none"}`;
      const truncationNote = truncated ? `\n\n_Showing first ${limit} of ${results.length} results. Use filters or increase limit to see more._` : "";

      return {
        content: [
          {
            type: "text",
            text: `${metadataSection}\n\nFound ${results.length} learning(s):\n\n${formatted}${truncationNote}`,
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
    description: "Create a new learning. IMPORTANT: Before using this tool, invoke the 'learning_guidelines' or 'create_learning' prompt to understand the proper format and structure.",
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
