import { readdir, readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";

const LEARNINGS_DIR = join(import.meta.dir, "../learnings");

export interface LearningMetadata {
  title: string;
  topic: string;
  tags: string[];
  created: string;
  related: string[];
}

export interface Learning {
  filename: string;
  metadata: LearningMetadata;
  content: string;
}

/**
 * Parse front matter and content from markdown
 */
function parseLearning(markdown: string): { metadata: LearningMetadata; content: string } {
  const frontMatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontMatterMatch) {
    throw new Error("Invalid learning format: missing front matter");
  }

  const [, frontMatter, content] = frontMatterMatch;

  // Parse YAML front matter (simple parser for our known structure)
  const metadata: Partial<LearningMetadata> = {};

  frontMatter.split("\n").forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) return;

    const [, key, value] = match;

    if (key === "tags" || key === "related") {
      // Parse arrays
      metadata[key] = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    } else {
      metadata[key as keyof LearningMetadata] = value.trim() as any;
    }
  });

  if (!metadata.title || !metadata.topic || !metadata.created) {
    throw new Error("Invalid learning: missing required metadata (title, topic, created)");
  }

  return {
    metadata: {
      title: metadata.title,
      topic: metadata.topic,
      tags: metadata.tags || [],
      created: metadata.created,
      related: metadata.related || [],
    },
    content: content.trim(),
  };
}

/**
 * Serialize learning to markdown with front matter
 */
function serializeLearning(metadata: LearningMetadata, content: string): string {
  const frontMatter = [
    "---",
    `title: ${metadata.title}`,
    `topic: ${metadata.topic}`,
    `tags: [${metadata.tags.join(", ")}]`,
    `created: ${metadata.created}`,
    `related: [${metadata.related.join(", ")}]`,
    "---",
  ].join("\n");

  return `${frontMatter}\n\n${content}`;
}

/**
 * List all learning files
 */
export async function listLearningFiles(): Promise<string[]> {
  const files = await readdir(LEARNINGS_DIR);
  return files.filter(f => f.endsWith(".md") && f !== "README.md");
}

/**
 * Read a learning by filename
 */
export async function readLearning(filename: string): Promise<Learning> {
  const filepath = join(LEARNINGS_DIR, filename);
  const markdown = await readFile(filepath, "utf-8");
  const { metadata, content } = parseLearning(markdown);

  return { filename, metadata, content };
}

/**
 * Write a learning
 */
export async function writeLearning(
  filename: string,
  metadata: LearningMetadata,
  content: string
): Promise<void> {
  const filepath = join(LEARNINGS_DIR, filename);
  const markdown = serializeLearning(metadata, content);
  await writeFile(filepath, markdown, "utf-8");
}

/**
 * Delete a learning
 */
export async function deleteLearning(filename: string): Promise<void> {
  const filepath = join(LEARNINGS_DIR, filename);
  await unlink(filepath);
}

/**
 * Search learnings by topic, tags, or text
 */
export async function searchLearnings(options: {
  topic?: string;
  tags?: string[];
  search?: string;
}): Promise<Array<{ filename: string; title: string; topic: string }>> {
  const files = await listLearningFiles();
  const results: Array<{ filename: string; title: string; topic: string }> = [];

  for (const filename of files) {
    const learning = await readLearning(filename);

    // Filter by topic
    if (options.topic && learning.metadata.topic !== options.topic) {
      continue;
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      const hasAllTags = options.tags.every(tag =>
        learning.metadata.tags.includes(tag)
      );
      if (!hasAllTags) continue;
    }

    // Filter by text search
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      const fullText = `${learning.metadata.title} ${learning.content}`.toLowerCase();
      if (!fullText.includes(searchLower)) {
        continue;
      }
    }

    results.push({
      filename: learning.filename,
      title: learning.metadata.title,
      topic: learning.metadata.topic,
    });
  }

  return results;
}
