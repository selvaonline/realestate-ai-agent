// src/routes/mcp.ts — Remote MCP server endpoint
// Exposes the active domain pack's tools via Model Context Protocol over
// Streamable HTTP. Tool wrappers, the landing page, and the capabilities
// resource are all generated from the platform registry + pack metadata —
// no hand-written per-tool duplication.
// Usage: clients connect to https://reagent.selvaonline.com/mcp

import { Router, json } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toolRegistry } from "../platform/registry.js";
import { getActivePack } from "../platform/domainPack.js";
import { jsonSchemaToZod } from "../langgraph/specialists.js";

const BACKEND_URL = process.env.DEALSENSE_URL || "https://reagent.selvaonline.com";

// ── Session management ──────────────────────────────────────────────────────

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
}

const sessions = new Map<string, McpSession>();

// Cleanup stale sessions every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour TTL
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) {
      session.transport.close().catch(() => {});
      session.server.close().catch(() => {});
      sessions.delete(id);
      console.log(`[mcp] Cleaned up stale session ${id}`);
    }
  }
}, 30 * 60 * 1000);

// ── Tool & resource registration (generated from the registry) ─────────────

function registerTools(server: McpServer) {
  const pack = getActivePack();

  for (const [name, reg] of toolRegistry) {
    server.tool(
      name,
      reg.schema.description,
      jsonSchemaToZod(reg.schema.parameters).shape,
      async (args: Record<string, any>) => {
        // strip nulls/undefined so registry destructuring defaults apply
        const clean = Object.fromEntries(
          Object.entries(args || {}).filter(([, v]) => v !== null && v !== undefined)
        );
        const result = await reg.execute(clean, { pub: () => {} });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }
    );
  }

  // Resource: capabilities
  const capabilitiesUri = `${pack.id}://capabilities`;
  server.resource("capabilities", capabilitiesUri, async () => ({
    contents: [{
      uri: capabilitiesUri,
      mimeType: "text/markdown",
      text: capabilitiesMarkdown(),
    }],
  }));
}

function capabilitiesMarkdown(): string {
  const pack = getActivePack();
  const toolRows = Array.from(toolRegistry.entries())
    .map(([name, t]) => `| ${name} | ${t.category} | ${t.schema.description.slice(0, 110)} |`)
    .join("\n");
  const sourceRows = (pack.dataSources || [])
    .map((s) => `- **${s.source}** — ${s.data}`)
    .join("\n");

  return `# ${pack.name} — MCP Server

${pack.description}

## Tools Available (${toolRegistry.size} tools)
| Tool | Category | Description |
|------|----------|-------------|
${toolRows}

## Data Sources
${sourceRows}

## Backend
${BACKEND_URL}

Built by [Selvakumar Murugesan](https://www.linkedin.com/in/selvaonline/)
`;
}

// ── Create a new MCP session ────────────────────────────────────────────────

function createMcpSession(): McpSession {
  const server = new McpServer(
    { name: getActivePack().id, version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  registerTools(server);

  return { transport, server, createdAt: Date.now() };
}

// ── Landing page HTML (lazy: built from the active pack on first request) ──

let landingHtmlCache: string | null = null;

function landingHtml(): string {
  if (landingHtmlCache) return landingHtmlCache;
  const pack = getActivePack();

  const toolList = Array.from(toolRegistry.entries()).map(([name, t]) => {
    const desc = t.schema.description.slice(0, 90);
    return `<tr><td><code>${name}</code></td><td>${t.category}</td><td>${desc}</td></tr>`;
  }).join("\n");

  const categories = new Set(Array.from(toolRegistry.values()).map((t) => t.category));
  const sourceRows = (pack.dataSources || [])
    .map((s) => `<tr><td>${s.source}</td><td>${s.data}</td></tr>`)
    .join("\n");

  landingHtmlCache = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${pack.name} MCP Server</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh;padding:40px 20px}
.container{max-width:900px;margin:0 auto}
.hero{text-align:center;margin-bottom:48px}
.hero h1{font-size:2.2rem;background:linear-gradient(135deg,#60a5fa,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
.hero .badge{display:inline-block;background:#1e293b;border:1px solid #334155;border-radius:20px;padding:4px 14px;font-size:.8rem;color:#94a3b8;margin-bottom:16px}
.hero p{color:#94a3b8;font-size:1.05rem;max-width:600px;margin:0 auto}
.card{background:#111827;border:1px solid #1e293b;border-radius:12px;padding:24px;margin-bottom:24px}
.card h2{font-size:1.15rem;color:#f1f5f9;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card h2 .icon{font-size:1.3rem}
.connect-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.connect-item{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px}
.connect-item h3{font-size:.9rem;color:#60a5fa;margin-bottom:8px}
.connect-item code{display:block;background:#1e293b;padding:10px;border-radius:6px;font-size:.75rem;color:#a5f3fc;word-break:break-all;white-space:pre-wrap;line-height:1.5}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;padding:8px 12px;color:#94a3b8;border-bottom:1px solid #1e293b;font-weight:600}
td{padding:8px 12px;border-bottom:1px solid #1e293b10}
td code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:.8rem;color:#a5f3fc}
tr:hover{background:#1e293b40}
.stats{display:flex;gap:24px;margin-bottom:24px;flex-wrap:wrap}
.stat{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 24px;text-align:center;flex:1;min-width:120px}
.stat .num{font-size:1.8rem;font-weight:700;color:#60a5fa}
.stat .label{font-size:.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
.footer{text-align:center;margin-top:40px;color:#475569;font-size:.8rem}
.footer a{color:#60a5fa;text-decoration:none}
.pulse{display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%;margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    <h1>${pack.name} MCP Server</h1>
    <div class="badge"><span class="pulse"></span>Online — Model Context Protocol</div>
    <p>Connect your AI assistant to ${toolRegistry.size} tools — ${pack.description}</p>
  </div>

  <div class="stats">
    <div class="stat"><div class="num">${toolRegistry.size}</div><div class="label">Tools</div></div>
    <div class="stat"><div class="num">${(pack.dataSources || []).length}</div><div class="label">Data Sources</div></div>
    <div class="stat"><div class="num">${categories.size}</div><div class="label">Categories</div></div>
    <div class="stat"><div class="num">v1.0</div><div class="label">Version</div></div>
  </div>

  <div class="card">
    <h2><span class="icon">🔌</span> Connect Your AI Client</h2>
    <div class="connect-grid">
      <div class="connect-item">
        <h3>Claude Desktop</h3>
        <code>{
  "mcpServers": {
    "${pack.id}": {
      "url": "${BACKEND_URL}/mcp"
    }
  }
}</code>
      </div>
      <div class="connect-item">
        <h3>Claude Code (CLI)</h3>
        <code>claude mcp add ${pack.id} \\
  --transport http \\
  ${BACKEND_URL}/mcp</code>
      </div>
      <div class="connect-item">
        <h3>Cursor / Windsurf</h3>
        <code>{
  "mcpServers": {
    "${pack.id}": {
      "url": "${BACKEND_URL}/mcp"
    }
  }
}</code>
      </div>
    </div>
  </div>

  <div class="card">
    <h2><span class="icon">🛠️</span> Available Tools</h2>
    <table>
      <thead><tr><th>Tool</th><th>Category</th><th>Description</th></tr></thead>
      <tbody>
        ${toolList}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2><span class="icon">📡</span> Data Sources</h2>
    <table>
      <thead><tr><th>Source</th><th>Data</th></tr></thead>
      <tbody>
        ${sourceRows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Built by <a href="https://www.linkedin.com/in/selvaonline/" target="_blank">Selvakumar Murugesan</a> &middot;
    <a href="${BACKEND_URL}">${pack.name} Agent</a>
  </div>
</div>
</body>
</html>`;
  return landingHtmlCache;
}

// ── Express Router ──────────────────────────────────────────────────────────

export const mcpRouter = Router();

// Parse JSON for MCP requests
mcpRouter.use(json());

// Handle all MCP methods on /
mcpRouter.post("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Existing session
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // New session (initialization)
  const session = createMcpSession();

  // Connect server to transport
  await session.server.connect(session.transport);

  // Store session after transport assigns its ID
  const onSessionReady = () => {
    const sid = session.transport.sessionId;
    if (sid) {
      sessions.set(sid, session);
      console.log(`[mcp] New session: ${sid} (total: ${sessions.size})`);
    }
  };

  // Handle the initialize request
  await session.transport.handleRequest(req, res, req.body);

  // Store session by its generated ID
  onSessionReady();
});

mcpRouter.get("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Active MCP session — delegate to transport
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  // Browser visit — serve a landing page
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(landingHtml());
    return;
  }

  // API/curl visit — return JSON capabilities
  const pack = getActivePack();
  res.json({
    name: `${pack.name} MCP Server`,
    version: "1.0.0",
    protocol: "Model Context Protocol (Streamable HTTP)",
    endpoint: `${BACKEND_URL}/mcp`,
    activeSessions: sessions.size,
    tools: Array.from(toolRegistry.keys()),
    toolCount: toolRegistry.size,
    connect: {
      claude_desktop: {
        config: `Add to ~/Library/Application Support/Claude/claude_desktop_config.json`,
        example: { mcpServers: { [pack.id]: { url: `${BACKEND_URL}/mcp` } } },
      },
      cursor: {
        config: `Add to .cursor/mcp.json`,
        example: { mcpServers: { [pack.id]: { url: `${BACKEND_URL}/mcp` } } },
      },
      claude_code: `claude mcp add ${pack.id} --transport http ${BACKEND_URL}/mcp`,
    },
  });
});

mcpRouter.delete("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  await session.transport.close();
  await session.server.close();
  sessions.delete(sessionId);
  console.log(`[mcp] Session ended: ${sessionId} (remaining: ${sessions.size})`);
});

console.log("[mcp] MCP server route initialized (tools generated from registry)");
