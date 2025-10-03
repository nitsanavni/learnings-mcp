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

### Claude Code CLI (User Scope)

If you're using the Claude Code CLI, you can add this MCP server globally for all your projects:

```bash
claude mcp add -s user learnings bunx -- github:nitsanavni/learnings-mcp --repository https://github.com/yourusername/your-learnings-repo.git --clone-location ~/.learnings/learnings
```

This adds the server to your user-level MCP configuration, making it available across all Claude Code sessions.

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
- `--repository <path-or-url>`: Repository path or GitHub URL for storing global learnings
- `--clone-location <path>`: Where to clone remote repositories (default: `~/.learnings/<repo-name>`)
- `--local-learnings-folder <path>`: Local learnings folder relative to current directory (default: `learnings`)

This will automatically fetch and run the latest version from GitHub.

**Note:** To ensure you're running the latest version, you may need to clear Bun's cache:

```bash
bun pm cache rm
```

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

### Global vs Local Learnings

The server supports two types of learnings:

- **Global learnings**: Stored in the repository specified by `--repository`. These are automatically committed and pushed to the remote repository (if it's a git repo). This is the **recommended default** for learnings you want to share across projects.

- **Local learnings**: Stored in a folder relative to your current working directory (default: `learnings/`, configurable via `--local-learnings-folder`). These are **not** committed to git automatically - they're just files on your local filesystem. Use these for project-specific or temporary learnings.

When listing or getting learnings, the server will show results from both global and local repositories. When adding a learning, you can specify `scope: "global"` (default) or `scope: "local"`.

## Development

This project uses [Bun](https://bun.com) as its runtime.

To run locally:

```bash
bun run index.ts
```
