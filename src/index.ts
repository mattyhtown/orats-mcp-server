#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createOratsMcpServer } from "./tools.js";

const server = createOratsMcpServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ORATS MCP Server running on stdio");
}

main().catch(console.error);
