#!/usr/bin/env bun

// Router: Dispatch to MCP server or CLI based on mode argument
const mode = Bun.argv[2];

if (mode === "mcp") {
  // Remove 'mcp' from argv so it doesn't interfere with the server's argument parsing
  Bun.argv.splice(2, 1);
  await import("./src/mcp-server.js");
} else if (mode === "cli") {
  // Remove 'cli' from argv so it doesn't interfere with the CLI's argument parsing
  Bun.argv.splice(2, 1);
  await import("./src/cli.js");
} else {
  console.error("Error: Mode argument required. Use 'mcp' or 'cli'");
  console.error("\nUsage:");
  console.error("  MCP mode: bunx github:nitsanavni/learnings-mcp mcp [options]");
  console.error("  CLI mode: bunx github:nitsanavni/learnings-mcp cli [options] <command>");
  process.exit(1);
}
