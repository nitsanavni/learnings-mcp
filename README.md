# learnings-mcp

A Model Context Protocol (MCP) server for managing learning prompts.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open protocol that standardizes how applications provide context to LLMs. It enables AI applications like Claude to seamlessly integrate with external data sources and tools.

## Installation

This MCP server is not published to npm. Install it directly from GitHub using Bun:

```bash
bun install github:nitsanavni/learnings-mcp
```

Or clone the repository:

```bash
git clone https://github.com/nitsanavni/learnings-mcp.git
cd learnings-mcp
bun install
```

## Configuration

### Claude Desktop

Add this server to your Claude Desktop configuration file:

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Option 1: Run directly from GitHub (Recommended)

```json
{
  "mcpServers": {
    "learnings": {
      "command": "bunx",
      "args": [
        "--bun",
        "github:nitsanavni/learnings-mcp",
        "--repository",
        "https://github.com/yourusername/your-learnings-repo.git",
        "--clone-location",
        "/path/to/clone/location"
      ]
    }
  }
}
```

**CLI Arguments:**
- `--repository <path-or-url>`: Repository path or GitHub URL for storing learnings
- `--clone-location <path>`: Where to clone remote repositories (default: `~/.learnings/<repo-name>`)

This will automatically fetch and run the latest version from GitHub.

#### Option 2: Run from local clone

```json
{
  "mcpServers": {
    "learnings": {
      "command": "bun",
      "args": [
        "run",
        "/ABSOLUTE/PATH/TO/learnings-mcp/index.ts",
        "--repository",
        "https://github.com/yourusername/your-learnings-repo.git",
        "--clone-location",
        "/path/to/clone/location"
      ]
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/learnings-mcp/` with the actual path where you cloned this repository.

### Restart Claude Desktop

After updating the configuration, restart Claude Desktop for the changes to take effect.

## Usage

Once configured, you can interact with learning prompts through Claude Desktop using the tools provided by this MCP server.

## Development

This project uses [Bun](https://bun.com) as its runtime.

To run locally:

```bash
bun run index.ts
```
