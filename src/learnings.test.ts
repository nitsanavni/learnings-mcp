import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystemRepository } from "./FileSystemRepository.js";
import { LearningsModule } from "./learnings.js";

let tempDir: string;
let learnings: LearningsModule;

beforeEach(async () => {
  // Create a temporary directory for each test
  tempDir = await mkdtemp(join(tmpdir(), "learnings-test-"));
  const repository = new FileSystemRepository(tempDir);
  learnings = new LearningsModule(repository);
});

afterEach(async () => {
  // Clean up temp directory after each test
  await rm(tempDir, { recursive: true, force: true });
});

test("add and get learning", async () => {
  // Add a learning
  const result = await learnings.add({
    filename: "test-learning",
    title: "Test Learning",
    topic: "testing",
    tags: ["test", "example"],
    oneLiner: "This is a test learning",
    context: "Use this when testing",
    examples: "```ts\nconst x = 1;\n```",
    related: [],
  });

  expect(result.filename).toBe("test-learning.md");

  // Get the learning back
  const learning = await learnings.get("test-learning.md");

  expect(learning.metadata.title).toBe("Test Learning");
  expect(learning.metadata.topic).toBe("testing");
  expect(learning.metadata.tags).toEqual(["test", "example"]);
  expect(learning.content).toContain("This is a test learning");
  expect(learning.content).toContain("Use this when testing");
  expect(learning.content).toContain("```ts\nconst x = 1;\n```");
});

test("list learnings - empty", async () => {
  const results = await learnings.list({});
  expect(results).toEqual([]);
});

test("list learnings - with results", async () => {
  // Add multiple learnings
  await learnings.add({
    filename: "git-rebase.md",
    title: "Git Rebase",
    topic: "git",
    tags: ["git", "rebase"],
    oneLiner: "Rebase commits",
    context: "When cleaning up history",
    examples: "git rebase -i HEAD~3",
  });

  await learnings.add({
    filename: "typescript-types.md",
    title: "TypeScript Types",
    topic: "typescript",
    tags: ["typescript", "types"],
    oneLiner: "Type definitions",
    context: "When defining types",
    examples: "type Foo = { bar: string }",
  });

  const results = await learnings.list({});
  expect(results.length).toBe(2);
});

test("search by topic", async () => {
  await learnings.add({
    filename: "git-rebase.md",
    title: "Git Rebase",
    topic: "git",
    oneLiner: "Rebase commits",
    context: "When cleaning up history",
    examples: "git rebase -i HEAD~3",
  });

  await learnings.add({
    filename: "typescript-types.md",
    title: "TypeScript Types",
    topic: "typescript",
    oneLiner: "Type definitions",
    context: "When defining types",
    examples: "type Foo = { bar: string }",
  });

  const results = await learnings.list({ topic: "git" });
  expect(results.length).toBe(1);
  expect(results[0]?.filename).toBe("git-rebase.md");
});

test("search by tags", async () => {
  await learnings.add({
    filename: "git-rebase.md",
    title: "Git Rebase",
    topic: "git",
    tags: ["git", "rebase", "interactive"],
    oneLiner: "Rebase commits",
    context: "When cleaning up history",
    examples: "git rebase -i HEAD~3",
  });

  await learnings.add({
    filename: "git-merge.md",
    title: "Git Merge",
    topic: "git",
    tags: ["git", "merge"],
    oneLiner: "Merge branches",
    context: "When combining branches",
    examples: "git merge feature",
  });

  const results = await learnings.list({ tags: ["rebase"] });
  expect(results.length).toBe(1);
  expect(results[0]?.filename).toBe("git-rebase.md");
});

test("search by text", async () => {
  await learnings.add({
    filename: "git-rebase.md",
    title: "Git Rebase",
    topic: "git",
    oneLiner: "Rebase commits",
    context: "When cleaning up history",
    examples: "git rebase -i HEAD~3",
  });

  await learnings.add({
    filename: "typescript-types.md",
    title: "TypeScript Types",
    topic: "typescript",
    oneLiner: "Type definitions",
    context: "When defining types",
    examples: "type Foo = { bar: string }",
  });

  const results = await learnings.list({ search: "history" });
  expect(results.length).toBe(1);
  expect(results[0]?.filename).toBe("git-rebase.md");
});

test("remove learning", async () => {
  // Add a learning
  await learnings.add({
    filename: "to-delete.md",
    title: "To Delete",
    topic: "test",
    oneLiner: "This will be deleted",
    context: "Testing deletion",
    examples: "N/A",
  });

  // Verify it exists
  let results = await learnings.list({});
  expect(results.length).toBe(1);

  // Remove it
  await learnings.remove("to-delete.md");

  // Verify it's gone
  results = await learnings.list({});
  expect(results.length).toBe(0);
});

test("add learning with related learnings", async () => {
  await learnings.add({
    filename: "parent-learning.md",
    title: "Parent Learning",
    topic: "test",
    oneLiner: "Has related learnings",
    context: "Testing relationships",
    examples: "N/A",
    related: ["child-1.md", "child-2.md"],
  });

  const learning = await learnings.get("parent-learning.md");
  expect(learning.metadata.related).toEqual(["child-1.md", "child-2.md"]);
  expect(learning.content).toContain("## See Also");
  expect(learning.content).toContain("[child-1.md](./child-1.md)");
  expect(learning.content).toContain("[child-2.md](./child-2.md)");
});

test("filename normalization", async () => {
  // Add without .md extension
  const result = await learnings.add({
    filename: "no-extension",
    title: "No Extension",
    topic: "test",
    oneLiner: "Testing filename normalization",
    context: "Should add .md automatically",
    examples: "N/A",
  });

  expect(result.filename).toBe("no-extension.md");

  // Should be retrievable with .md
  const learning = await learnings.get("no-extension.md");
  expect(learning.metadata.title).toBe("No Extension");
});
