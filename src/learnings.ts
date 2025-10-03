import type { Repository, LearningMetadata, SearchResult } from "./repository.js";

/**
 * Learnings module - business logic layer
 * Accepts a Repository implementation via dependency injection
 */
export class LearningsModule {
  constructor(private readonly repository: Repository) {}

  /**
   * List learnings with optional filtering
   */
  async list(options: {
    topic?: string;
    tags?: string[];
    search?: string;
  }): Promise<SearchResult[]> {
    return this.repository.search(options);
  }

  /**
   * Get full learning content by filename
   */
  async get(filename: string) {
    return this.repository.read(filename);
  }

  /**
   * Add a new learning
   */
  async add(params: {
    filename: string;
    title: string;
    topic: string;
    tags?: string[];
    oneLiner: string;
    context: string;
    examples: string;
    related?: string[];
  }) {
    // Ensure filename ends with .md
    const normalizedFilename = params.filename.endsWith(".md")
      ? params.filename
      : `${params.filename}.md`;

    const metadata: LearningMetadata = {
      title: params.title,
      topic: params.topic,
      tags: params.tags || [],
      created: new Date().toISOString().split("T")[0], // YYYY-MM-DD
      related: params.related || [],
    };

    const content = `# ${params.title}

${params.oneLiner}

## Context

${params.context}

## Examples

${params.examples}${
      params.related && params.related.length > 0
        ? `\n\n## See Also\n\n${params.related.map((r) => `- [${r}](./${r})`).join("\n")}`
        : ""
    }`;

    await this.repository.write(normalizedFilename, metadata, content);

    return { filename: normalizedFilename };
  }

  /**
   * Remove a learning by filename
   */
  async remove(filename: string) {
    await this.repository.delete(filename);
  }

  /**
   * Get all unique topics and tags from all learnings, sorted by usage count
   */
  async getMetadata(): Promise<{ topics: string[]; tags: string[] }> {
    const files = await this.repository.listFiles();
    const topicCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();

    for (const filename of files) {
      const learning = await this.repository.read(filename);
      topicCounts.set(learning.metadata.topic, (topicCounts.get(learning.metadata.topic) || 0) + 1);
      learning.metadata.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    }

    // Sort by count (descending), then alphabetically
    const sortByCount = (a: [string, number], b: [string, number]) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    };

    return {
      topics: Array.from(topicCounts.entries()).sort(sortByCount).map(([topic]) => topic),
      tags: Array.from(tagCounts.entries()).sort(sortByCount).map(([tag]) => tag),
    };
  }
}
