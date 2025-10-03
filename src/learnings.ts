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
}
