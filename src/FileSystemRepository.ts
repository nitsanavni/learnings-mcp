import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Learning,
  LearningMetadata,
  Repository,
  SearchOptions,
  SearchResult,
} from "./repository.js";

/**
 * File system based repository implementation
 */
export class FileSystemRepository implements Repository {
  constructor(protected readonly baseDir: string) {}

  /**
   * Parse front matter and content from markdown
   */
  private parseLearning(markdown: string): {
    metadata: LearningMetadata;
    content: string;
  } {
    const frontMatterMatch = markdown.match(
      /^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
    );

    if (!frontMatterMatch) {
      throw new Error("Invalid learning format: missing front matter");
    }

    const frontMatter = frontMatterMatch[1];
    const content = frontMatterMatch[2];

    if (!frontMatter) {
      throw new Error("Invalid learning format: empty front matter");
    }

    // Parse YAML front matter (simple parser for our known structure)
    const metadata: Partial<LearningMetadata> = {};

    frontMatter.split("\n").forEach((line) => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (!match) return;

      const key = match[1];
      const value = match[2];

      if (!key || !value) return;

      if (key === "tags" || key === "related") {
        // Parse arrays
        metadata[key] = value
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        (metadata as Record<string, string>)[key] = value.trim();
      }
    });

    if (!metadata.title || !metadata.topic || !metadata.created) {
      throw new Error(
        "Invalid learning: missing required metadata (title, topic, created)",
      );
    }

    return {
      metadata: {
        title: metadata.title,
        topic: metadata.topic,
        tags: metadata.tags || [],
        created: metadata.created,
        related: metadata.related || [],
      },
      content: (content ?? "").trim(),
    };
  }

  /**
   * Serialize learning to markdown with front matter
   */
  private serializeLearning(
    metadata: LearningMetadata,
    content: string,
  ): string {
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

  async listFiles(): Promise<string[]> {
    const files = await readdir(this.baseDir);
    return files.filter((f) => f.endsWith(".md") && f !== "README.md");
  }

  async read(filename: string): Promise<Learning> {
    const filepath = join(this.baseDir, filename);
    const markdown = await readFile(filepath, "utf-8");
    const { metadata, content } = this.parseLearning(markdown);

    return { filename, metadata, content };
  }

  async write(
    filename: string,
    metadata: LearningMetadata,
    content: string,
  ): Promise<void> {
    const filepath = join(this.baseDir, filename);
    const markdown = this.serializeLearning(metadata, content);
    await writeFile(filepath, markdown, "utf-8");
  }

  async delete(filename: string): Promise<void> {
    const filepath = join(this.baseDir, filename);
    await unlink(filepath);
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const files = await this.listFiles();
    const results: SearchResult[] = [];

    for (const filename of files) {
      const learning = await this.read(filename);

      // Filter by topic
      if (options.topic && learning.metadata.topic !== options.topic) {
        continue;
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        const hasAllTags = options.tags.every((tag) =>
          learning.metadata.tags.includes(tag),
        );
        if (!hasAllTags) continue;
      }

      // Filter by text search
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const fullText =
          `${learning.metadata.title} ${learning.content}`.toLowerCase();
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
}
