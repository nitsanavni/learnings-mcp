import { existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";

export interface Config {
  /** Path to the learnings directory (already resolved) */
  learningsPath: string;
  /** Whether this is a git repository */
  isGitRepo: boolean;
}

/**
 * Extract repository name from URL
 * e.g., "https://github.com/user/my-learnings.git" -> "my-learnings"
 */
function extractRepoName(url: string): string {
  const match = url.match(/\/([^\/]+?)(\.git)?$/);
  if (!match) {
    throw new Error(`Cannot extract repository name from URL: ${url}`);
  }
  return match[1];
}

/**
 * Check if a string is a URL
 */
function isUrl(str: string): boolean {
  return str.startsWith("http://") ||
         str.startsWith("https://") ||
         str.startsWith("git@");
}

/**
 * Clone a git repository
 */
function cloneRepository(url: string, targetPath: string): void {
  console.error(`Cloning ${url} to ${targetPath}...`);

  // Ensure parent directory exists
  const parentDir = join(targetPath, "..");
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  try {
    execSync(`git clone "${url}" "${targetPath}"`, {
      stdio: "inherit",
    });
  } catch (error) {
    throw new Error(
      `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Resolve ~ in paths
 */
function resolveTilde(filepath: string): string {
  if (filepath.startsWith("~/")) {
    return join(homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Load and validate configuration from CLI arguments
 */
export function loadConfig(options: {
  repository?: string;
  cloneLocation?: string;
}): Config {
  // Validate required argument
  if (!options.repository) {
    throw new Error(`Configuration Error: Missing required --repository argument

Please provide a repository location:

  For a GitHub URL:
    bun run index.ts --repository=https://github.com/user/my-learnings.git

  For a local path:
    bun run index.ts --repository=/path/to/local/repo

Optional: Specify where to clone remote repositories
    --clone-location=~/.learnings/my-learnings

The learnings will be stored in a 'learnings/' subdirectory within the repository.
`);
  }

  let repoPath: string;
  let isGitRepo = false;

  if (isUrl(options.repository)) {
    // It's a URL - need to clone or use existing clone
    const repoName = extractRepoName(options.repository);
    const defaultCloneLocation = join(homedir(), ".learnings", repoName);
    const cloneLocation = options.cloneLocation
      ? resolveTilde(options.cloneLocation)
      : defaultCloneLocation;

    if (!existsSync(cloneLocation)) {
      // Need to clone
      cloneRepository(options.repository, cloneLocation);
    } else {
      console.error(`Using existing clone at ${cloneLocation}`);
    }

    repoPath = cloneLocation;
    isGitRepo = true;
  } else {
    // It's a local path
    repoPath = resolveTilde(options.repository);

    if (!existsSync(repoPath)) {
      throw new Error(`Repository path does not exist: ${repoPath}

Please ensure the path exists, or provide a GitHub URL to clone.
`);
    }

    // Check if it's a git repository
    const gitDir = join(repoPath, ".git");
    isGitRepo = existsSync(gitDir);

    if (!isGitRepo) {
      console.error(`Warning: ${repoPath} is not a git repository. Changes will not be committed automatically.`);
    }
  }

  // Learnings go in a subdirectory
  const learningsPath = join(repoPath, "learnings");

  // Ensure learnings directory exists
  if (!existsSync(learningsPath)) {
    mkdirSync(learningsPath, { recursive: true });
  }

  return {
    learningsPath,
    isGitRepo,
  };
}
