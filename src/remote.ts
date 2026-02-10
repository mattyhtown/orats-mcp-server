#!/usr/bin/env node

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createOratsMcpServer } from "./tools.js";

const PORT = parseInt(process.env.PORT || "8080", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error("Warning: AUTH_TOKEN not set — server is unauthenticated");
}

const app = express();
app.use(cors());
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "orats-mcp-server", version: "1.0.0" });
});

// Auth middleware for /mcp
function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!AUTH_TOKEN) {
    next();
    return;
  }
  const header = req.headers.authorization;
  if (!header || header !== `Bearer ${AUTH_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Map of session ID -> transport for stateful connections
const transports = new Map<string, StreamableHTTPServerTransport>();

// POST /mcp — handles JSON-RPC requests (including initialization)
app.post("/mcp", authMiddleware, async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      // Existing session
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session — create transport + server
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = createOratsMcpServer();
      await server.connect(transport);

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) transports.delete(sid);
      };

      // handleRequest processes the initialize and generates sessionId
      await transport.handleRequest(req, res, req.body);

      // Store AFTER handleRequest so sessionId is set
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }
    } else {
      res.status(400).json({ error: "Bad request: no valid session" });
      return;
    }
  } catch (error) {
    console.error("Error handling POST /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /mcp — SSE stream for server-to-client notifications
app.get("/mcp", authMiddleware, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// DELETE /mcp — close a session
app.delete("/mcp", authMiddleware, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.close();
  transports.delete(sessionId);
  res.status(200).json({ status: "session closed" });
});

function isInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((msg) => msg?.method === "initialize");
  }
  return (body as { method?: string })?.method === "initialize";
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ORATS MCP Server (HTTP) listening on port ${PORT}`);
  console.log(`Health: http://0.0.0.0:${PORT}/health`);
  console.log(`MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
});
