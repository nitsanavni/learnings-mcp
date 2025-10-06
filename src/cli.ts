#!/usr/bin/env bun
import { join } from "node:path";
import { program } from "commander";
import { loadConfig } from "./config.js";
import { FileSystemRepository } from "./FileSystemRepository.js";
import { GitHubRepository } from "./GitHubRepository.js";
import { LearningsModule } from "./learnings.js";

// Parse global options
program
  .name("learnings")
  .description("CLI for managing personal learnings")
  .version("1.0.0")
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
  );

// List learnings command
program
  .command("list")
  .alias("ls")
  .description("List and search learnings")
  .option("-t, --topic <topic>", "Filter by topic")
  .option("-T, --tags <tags...>", "Filter by tags (must have all)")
  .option("-s, --search <query>", "Text search in title and content")
  .option("-l, --limit <number>", "Maximum number of results (default: 10)", "10")
  .option("--scope <scope>", "Filter by scope: global, local, or all", "all")
  .action(async (options) => {
    const globalOpts = program.opts();
    const { globalLearnings, localLearnings } = await initializeLearnings(globalOpts);

    const limit = Number.parseInt(options.limit, 10);
    const filters = {
      topic: options.topic,
      tags: options.tags,
      search: options.search,
    };

    const shouldShowGlobal = options.scope === "all" || options.scope === "global";
    const shouldShowLocal = options.scope === "all" || options.scope === "local";

    const [globalResults, localResults, globalMeta, localMeta] = await Promise.all([
      shouldShowGlobal ? globalLearnings.list(filters) : Promise.resolve([]),
      shouldShowLocal ? localLearnings.list(filters) : Promise.resolve([]),
      globalLearnings.getMetadata(),
      localLearnings.getMetadata(),
    ]);

    const totalResults = globalResults.length + localResults.length;

    if (totalResults === 0) {
      const allTopics = [...new Set([...globalMeta.topics, ...localMeta.topics])];
      const allTags = [...new Set([...globalMeta.tags, ...localMeta.tags])];
      console.log("No learnings found matching the criteria.\n");
      console.log(`Available topics: ${allTopics.join(", ") || "none"}`);
      console.log(`Available tags: ${allTags.join(", ") || "none"}`);
      return;
    }

    // Show metadata
    const allTopics = [...new Set([...globalMeta.topics, ...localMeta.topics])];
    const allTags = [...new Set([...globalMeta.tags, ...localMeta.tags])];
    console.log(`Available topics: ${allTopics.join(", ") || "none"}`);
    console.log(`Available tags: ${allTags.join(", ") || "none"}\n`);

    // Apply limit proportionally
    const globalLimit = Math.ceil(limit * (globalResults.length / totalResults));
    const localLimit = limit - globalLimit;

    if (globalResults.length > 0 && shouldShowGlobal) {
      console.log(`Global learnings (${globalResults.length}):\n`);
      const display = globalResults.slice(0, globalLimit);
      for (const result of display) {
        console.log(`  ${result.filename}: ${result.title} (topic: ${result.topic})`);
      }
      if (globalResults.length > globalLimit) {
        console.log(`  ... and ${globalResults.length - globalLimit} more`);
      }
      console.log();
    }

    if (localResults.length > 0 && shouldShowLocal) {
      console.log(`Local learnings (${localResults.length}):\n`);
      const display = localResults.slice(0, localLimit);
      for (const result of display) {
        console.log(`  ${result.filename}: ${result.title} (topic: ${result.topic})`);
      }
      if (localResults.length > localLimit) {
        console.log(`  ... and ${localResults.length - localLimit} more`);
      }
      console.log();
    }

    if (totalResults > limit) {
      console.log(
        `Showing ${Math.min(limit, totalResults)} of ${totalResults} total results. Use --limit to see more.`,
      );
    }
  });

// Get learning command
program
  .command("get")
  .alias("show")
  .description("Get the full content of a learning")
  .argument("<filename>", "Learning filename (e.g., git-rebase.md)")
  .action(async (filename) => {
    const globalOpts = program.opts();
    const { globalLearnings, localLearnings } = await initializeLearnings(globalOpts);

    const results = await Promise.allSettled([
      globalLearnings.get(filename),
      localLearnings.get(filename),
    ]);

    const globalLearning = results[0].status === "fulfilled" ? results[0].value : null;
    const localLearning = results[1].status === "fulfilled" ? results[1].value : null;

    if (!globalLearning && !localLearning) {
      console.error(`Learning not found: ${filename}`);
      process.exit(1);
    }

    if (globalLearning) {
      console.log(`# ${globalLearning.metadata.title}\n`);
      console.log(`**Scope**: Global`);
      console.log(`**Topic**: ${globalLearning.metadata.topic}`);
      console.log(`**Tags**: ${globalLearning.metadata.tags.join(", ") || "none"}`);
      console.log(`**Created**: ${globalLearning.metadata.created}`);
      console.log(`**Related**: ${globalLearning.metadata.related.join(", ") || "none"}\n`);
      console.log("---\n");
      console.log(globalLearning.content);
    }

    if (localLearning) {
      if (globalLearning) console.log("\n---\n");
      console.log(`# ${localLearning.metadata.title}\n`);
      console.log(`**Scope**: Local`);
      console.log(`**Topic**: ${localLearning.metadata.topic}`);
      console.log(`**Tags**: ${localLearning.metadata.tags.join(", ") || "none"}`);
      console.log(`**Created**: ${localLearning.metadata.created}`);
      console.log(`**Related**: ${localLearning.metadata.related.join(", ") || "none"}\n`);
      console.log("---\n");
      console.log(localLearning.content);
    }
  });

// Add learning command
program
  .command("add")
  .description("Create a new learning")
  .requiredOption("-f, --filename <filename>", "Filename (format: {context}-{title}.md)")
  .requiredOption("-t, --title <title>", "Short descriptive title")
  .requiredOption("--topic <topic>", "Main topic/category")
  .requiredOption("-o, --one-liner <oneLiner>", "One-line description")
  .requiredOption("-c, --context <context>", "When/why to use this")
  .requiredOption("-e, --examples <examples>", "Code snippets and examples")
  .option("-T, --tags <tags...>", "Tags for categorization")
  .option("-r, --related <related...>", "Related learning filenames")
  .option(
    "-s, --scope <scope>",
    "Where to store (global or local)",
    "global",
  )
  .action(async (options) => {
    const globalOpts = program.opts();
    const { globalLearnings, localLearnings } = await initializeLearnings(globalOpts);

    const targetLearnings = options.scope === "local" ? localLearnings : globalLearnings;

    try {
      const result = await targetLearnings.add({
        filename: options.filename,
        title: options.title,
        topic: options.topic,
        tags: options.tags,
        oneLiner: options.oneLiner,
        context: options.context,
        examples: options.examples,
        related: options.related,
      });

      console.log(`Successfully created ${options.scope} learning: ${result.filename}`);
    } catch (error) {
      console.error(
        `Error creating learning: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

// Remove learning command
program
  .command("remove")
  .alias("rm")
  .description("Delete a learning")
  .argument("<filename>", "Learning filename to delete")
  .requiredOption(
    "-s, --scope <scope>",
    "Where to delete from (global or local)",
  )
  .action(async (filename, options) => {
    const globalOpts = program.opts();
    const { globalLearnings, localLearnings } = await initializeLearnings(globalOpts);

    const targetLearnings = options.scope === "local" ? localLearnings : globalLearnings;

    try {
      await targetLearnings.remove(filename);
      console.log(`Successfully deleted ${options.scope} learning: ${filename}`);
    } catch (error) {
      console.error(
        `Error deleting learning: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

// Helper function to initialize learnings modules
async function initializeLearnings(globalOpts: {
  repository?: string;
  cloneLocation?: string;
  localLearningsFolder?: string;
}) {
  const config = loadConfig({
    repository: globalOpts.repository,
    cloneLocation: globalOpts.cloneLocation,
  });

  const globalRepository = config.isGitRepo
    ? new GitHubRepository(config.learningsPath)
    : new FileSystemRepository(config.learningsPath);
  const globalLearnings = new LearningsModule(globalRepository);

  const localLearningsFolder = globalOpts.localLearningsFolder || "learnings";
  const localLearningsPath = join(process.cwd(), localLearningsFolder);
  const localRepository = new FileSystemRepository(localLearningsPath);
  const localLearnings = new LearningsModule(localRepository);

  return { globalLearnings, localLearnings };
}

program.parse();
