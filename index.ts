#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { loadConfig } from "./src/config.js";
import { FileSystemRepository } from "./src/FileSystemRepository.js";
import { GitHubRepository } from "./src/GitHubRepository.js";
import { LearningsModule } from "./src/learnings.js";
import { LEARNING_GUIDELINES, LEARNING_TEMPLATE } from "./src/prompts.js";

// Parse CLI arguments
program
  .name("learnings-mcp-server")
  .description("MCP server for managing personal learnings")
  .option(
    "--repository <path-or-url>",
    "Repository path or GitHub URL for storing learnings",
  )
  .option(
    "--clone-location <path>",
    "Where to clone remote repositories (default: ~/.learnings/<repo-name>)",
  )
  .option(
    "--local-learnings-folder <path>",
    "Local learnings folder relative to current directory (default: learnings)",
  )
  .parse();

const options = program.opts();

// Load and validate configuration
const config = loadConfig({
  repository: options.repository,
  cloneLocation: options.cloneLocation,
});

// Initialize global repository and learnings module
const globalRepository = config.isGitRepo
  ? new GitHubRepository(config.learningsPath)
  : new FileSystemRepository(config.learningsPath);
const globalLearnings = new LearningsModule(globalRepository);

// Initialize local repository (always FileSystemRepository, no git operations)
const localLearningsFolder = options.localLearningsFolder || "learnings";
const localLearningsPath = join(process.cwd(), localLearningsFolder);
if (!existsSync(localLearningsPath)) {
  mkdirSync(localLearningsPath, { recursive: true });
}
const localRepository = new FileSystemRepository(localLearningsPath);
const localLearnings = new LearningsModule(localRepository);

// Get metadata for dynamic descriptions from both repositories
const [globalMetadata, localMetadata] = await Promise.all([
  globalLearnings.getMetadata(),
  localLearnings.getMetadata(),
]);
const allTopics = [
  ...new Set([...globalMetadata.topics, ...localMetadata.topics]),
];
const allTags = [...new Set([...globalMetadata.tags, ...localMetadata.tags])];
const topicsPreview = allTopics.slice(0, 5).join(", ");
const tagsPreview = allTags.slice(0, 8).join(", ");

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
    description: `Search and list learnings by topic, tags, or text search. Available topics: ${topicsPreview}${allTopics.length > 5 ? "..." : ""}. Available tags: ${tagsPreview}${allTags.length > 8 ? "..." : ""}.`,
    inputSchema: {
      topic: z.string().optional().describe("Filter by topic"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Filter by tags (must have all)"),
      search: z
        .string()
        .optional()
        .describe("Text search in title and content"),
      limit: z
        .number()
        .optional()
        .default(6)
        .describe("Maximum number of results to return (default: 6)"),
    },
  },
  async ({ topic, tags, search, limit = 6 }) => {
    try {
      const [globalResults, localResults, globalMeta, localMeta] =
        await Promise.all([
          globalLearnings.list({ topic, tags, search }),
          localLearnings.list({ topic, tags, search }),
          globalLearnings.getMetadata(),
          localLearnings.getMetadata(),
        ]);

      const totalResults = globalResults.length + localResults.length;

      if (totalResults === 0) {
        const allTopics = [
          ...new Set([...globalMeta.topics, ...localMeta.topics]),
        ];
        const allTags = [...new Set([...globalMeta.tags, ...localMeta.tags])];
        return {
          content: [
            {
              type: "text",
              text: `No learnings found matching the criteria.\n\n**Available topics**: ${allTopics.join(", ") || "none"}\n**Available tags**: ${allTags.join(", ") || "none"}`,
            },
          ],
        };
      }

      // Apply limit to each section proportionally
      const globalLimit = Math.ceil(
        limit * (globalResults.length / totalResults),
      );
      const localLimit = limit - globalLimit;

      const displayGlobal = globalResults.slice(0, globalLimit);
      const displayLocal = localResults.slice(0, localLimit);

      let response = "";

      if (displayGlobal.length > 0) {
        const formatted = displayGlobal
          .map((r) => `- **${r.filename}**: ${r.title} (topic: ${r.topic})`)
          .join("\n");
        response += `**Global learnings** (${globalResults.length}):\n\n${formatted}`;
      }

      if (displayLocal.length > 0) {
        const formatted = displayLocal
          .map((r) => `- **${r.filename}**: ${r.title} (topic: ${r.topic})`)
          .join("\n");
        response +=
          (response ? "\n\n" : "") +
          `**Local learnings** (${localResults.length}):\n\n${formatted}`;
      }

      const allTopics = [
        ...new Set([...globalMeta.topics, ...localMeta.topics]),
      ];
      const allTags = [...new Set([...globalMeta.tags, ...localMeta.tags])];
      const metadataSection = `**Available topics**: ${allTopics.join(", ") || "none"}\n**Available tags**: ${allTags.join(", ") || "none"}`;

      const truncated =
        totalResults > displayGlobal.length + displayLocal.length;
      const truncationNote = truncated
        ? `\n\n_Showing ${displayGlobal.length + displayLocal.length} of ${totalResults} total results. Use filters or increase limit to see more._`
        : "";

      return {
        content: [
          {
            type: "text",
            text: `${metadataSection}\n\n${response}${truncationNote}`,
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
  },
);

// Tool: Get learning content
server.registerTool(
  "get_learning",
  {
    title: "Get Learning",
    description: "Fetch the full content of a learning by filename",
    inputSchema: {
      filename: z
        .string()
        .describe("The filename of the learning (e.g., 'git-rebase.md')"),
    },
  },
  async ({ filename }) => {
    try {
      const results = await Promise.allSettled([
        globalLearnings.get(filename),
        localLearnings.get(filename),
      ]);

      const globalLearning =
        results[0].status === "fulfilled" ? results[0].value : null;
      const localLearning =
        results[1].status === "fulfilled" ? results[1].value : null;

      if (!globalLearning && !localLearning) {
        return {
          content: [
            {
              type: "text",
              text: `Learning not found: ${filename}`,
            },
          ],
          isError: true,
        };
      }

      let response = "";

      if (globalLearning) {
        const formatted = `# ${globalLearning.metadata.title}

**Scope**: Global
**Topic**: ${globalLearning.metadata.topic}
**Tags**: ${globalLearning.metadata.tags.join(", ") || "none"}
**Created**: ${globalLearning.metadata.created}
**Related**: ${globalLearning.metadata.related.join(", ") || "none"}

---

${globalLearning.content}`;
        response += formatted;
      }

      if (localLearning) {
        const formatted = `# ${localLearning.metadata.title}

**Scope**: Local
**Topic**: ${localLearning.metadata.topic}
**Tags**: ${localLearning.metadata.tags.join(", ") || "none"}
**Created**: ${localLearning.metadata.created}
**Related**: ${localLearning.metadata.related.join(", ") || "none"}

---

${localLearning.content}`;
        response += (response ? "\n\n---\n\n" : "") + formatted;
      }

      return {
        content: [{ type: "text", text: response }],
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
  },
);

// Tool: Add learning
server.registerTool(
  "add_learning",
  {
    title: "Add Learning",
    description:
      "Create a new learning. IMPORTANT: Before using this tool, invoke the 'learning_guidelines' or 'create_learning' prompt to understand the proper format and structure.",
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
      related: z
        .array(z.string())
        .optional()
        .describe("Related learning filenames"),
      scope: z
        .enum(["global", "local"])
        .optional()
        .default("global")
        .describe("Where to store the learning (default: global, recommended)"),
    },
  },
  async ({
    filename,
    title,
    topic,
    tags,
    oneLiner,
    context,
    examples,
    related,
    scope = "global",
  }) => {
    try {
      const targetLearnings =
        scope === "local" ? localLearnings : globalLearnings;

      const result = await targetLearnings.add({
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
            text: `Successfully created ${scope} learning: ${result.filename}`,
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
  },
);

// Tool: Remove learning
server.registerTool(
  "remove_learning",
  {
    title: "Remove Learning",
    description: "Delete a learning by filename",
    inputSchema: {
      filename: z.string().describe("The filename of the learning to delete"),
      scope: z
        .enum(["global", "local"])
        .describe("Where to delete the learning from (global or local)"),
    },
  },
  async ({ filename, scope }) => {
    try {
      const targetLearnings =
        scope === "local" ? localLearnings : globalLearnings;
      await targetLearnings.remove(filename);

      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted ${scope} learning: ${filename}`,
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
  },
);

// Prompt: Learning guidelines
server.registerPrompt(
  "learning_guidelines",
  {
    title: "Learning Creation Guidelines",
    description:
      "Guidelines and best practices for creating well-structured learnings",
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
  }),
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
  ({ title, topic, context }) => LEARNING_TEMPLATE({ title, topic, context }),
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
