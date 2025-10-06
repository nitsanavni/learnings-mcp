#!/usr/bin/env bun

// Router: Dispatch to MCP server or CLI based on mode argument
const mode = Bun.argv[2];

if (mode === "mcp") {
  // Remove 'mcp' from argv so it doesn't interfere with the server's argument parsing
  Bun.argv.splice(2, 1);
  await import("./src/mcp-server.js");
} else {
  // Default to CLI mode (includes help, version, commands, etc.)
  await import("./src/cli.js");
}
