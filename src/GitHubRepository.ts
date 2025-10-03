import { execSync } from "child_process";
import { FileSystemRepository } from "./FileSystemRepository.js";
import type { LearningMetadata } from "./repository.js";

/**
 * GitHub-backed repository that auto-commits and pushes on writes
 */
export class GitHubRepository extends FileSystemRepository {
  constructor(baseDir: string) {
    super(baseDir);
  }

  /**
   * Execute git command in the base directory
   */
  private git(command: string): string {
    try {
      return execSync(`git ${command}`, {
        cwd: this.baseDir,
        encoding: "utf-8",
      });
    } catch (error) {
      throw new Error(
        `Git command failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Auto-commit and push changes
   */
  private async commitAndPush(message: string): Promise<void> {
    // Add all changes in learnings directory
    this.git("add .");

    // Check if there are changes to commit
    const status = this.git("status --porcelain");
    if (!status.trim()) {
      // No changes to commit
      return;
    }

    // Commit with message
    const fullMessage = `${message}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

    this.git(`commit -m "${fullMessage.replace(/"/g, '\\"')}"`);

    // Push to remote
    this.git("push");
  }

  async write(
    filename: string,
    metadata: LearningMetadata,
    content: string,
  ): Promise<void> {
    await super.write(filename, metadata, content);
    await this.commitAndPush(`Add learning: ${filename}`);
  }

  async delete(filename: string): Promise<void> {
    await super.delete(filename);
    await this.commitAndPush(`Remove learning: ${filename}`);
  }
}
