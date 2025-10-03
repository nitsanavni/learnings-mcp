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

export interface SearchOptions {
  topic?: string;
  tags?: string[];
  search?: string;
}

export interface SearchResult {
  filename: string;
  title: string;
  topic: string;
}

/**
 * Repository interface for managing learnings storage
 */
export interface Repository {
  /**
   * List all learning filenames
   */
  listFiles(): Promise<string[]>;

  /**
   * Read a learning by filename
   */
  read(filename: string): Promise<Learning>;

  /**
   * Write a learning (creates or updates)
   */
  write(
    filename: string,
    metadata: LearningMetadata,
    content: string,
  ): Promise<void>;

  /**
   * Delete a learning
   */
  delete(filename: string): Promise<void>;

  /**
   * Search learnings by criteria
   */
  search(options: SearchOptions): Promise<SearchResult[]>;
}
