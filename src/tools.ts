import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = "https://api.orats.io/datav2";

function getApiToken(): string {
  const token = process.env.ORATS_API_TOKEN;
  if (!token) {
    throw new Error("ORATS_API_TOKEN environment variable is required");
  }
  return token;
}

async function makeRequest(endpoint: string, params: Record<string, string> = {}) {
  const token = getApiToken();
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("token", token);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

const TOOLS = [
  { name: "live_strikes", description: "Get live options strikes data for a ticker", inputSchema: { type: "object" as const, properties: { ticker: { type: "string", description: "Stock ticker symbol" } }, required: ["ticker"] } },
  { name: "live_strikes_by_expiry", description: "Get live options strikes for specific expiration", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, expiry: { type: "string", description: "YYYY-MM-DD" } }, required: ["ticker", "expiry"] } },
  { name: "live_strikes_by_opra", description: "Get live options by OPRA symbol(s)", inputSchema: { type: "object" as const, properties: { tickers: { type: "string", description: "Comma-separated OPRA symbols" } }, required: ["tickers"] } },
  { name: "live_expirations", description: "Get available expiration dates", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, include: { type: "string" } }, required: ["ticker"] } },
  { name: "live_monies_implied", description: "Get live implied volatility monies data", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  { name: "live_monies_forecast", description: "Get live forecast monies data", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  { name: "live_summaries", description: "Get live summary data including IV rank", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  { name: "tickers", description: "Get list of available tickers", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } } } },
  { name: "strikes", description: "Get options strikes data (delayed)", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, fields: { type: "string" }, dte: { type: "string" }, delta: { type: "string" } }, required: ["ticker"] } },
  { name: "monies_implied", description: "Get implied volatility monies (delayed)", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, fields: { type: "string" } }, required: ["ticker"] } },
  { name: "monies_forecast", description: "Get forecast monies (delayed)", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, fields: { type: "string" } }, required: ["ticker"] } },
  { name: "summaries", description: "Get summary data (delayed)", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, fields: { type: "string" } }, required: ["ticker"] } },
  { name: "cores", description: "Get core data (price, earnings, dividends)", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, fields: { type: "string" } }, required: ["ticker"] } },
  { name: "ivrank", description: "Get IV rank and percentile data", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, fields: { type: "string" } }, required: ["ticker"] } },
  { name: "hist_strikes", description: "Get historical options strikes", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, tradeDate: { type: "string" }, fields: { type: "string" }, dte: { type: "string" }, delta: { type: "string" } }, required: ["ticker", "tradeDate"] } },
  { name: "hist_monies_implied", description: "Get historical implied monies", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, tradeDate: { type: "string" }, fields: { type: "string" } }, required: ["ticker", "tradeDate"] } },
  { name: "hist_summaries", description: "Get historical summaries", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, tradeDate: { type: "string" }, fields: { type: "string" } }, required: ["ticker", "tradeDate"] } },
  { name: "hist_cores", description: "Get historical core data", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, tradeDate: { type: "string" }, fields: { type: "string" } }, required: ["ticker", "tradeDate"] } },
  { name: "hist_dailies", description: "Get historical daily prices", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, tradeDate: { type: "string" }, fields: { type: "string" } }, required: ["ticker", "tradeDate"] } },
  { name: "hist_hvs", description: "Get historical volatility data", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, tradeDate: { type: "string" }, fields: { type: "string" } }, required: ["ticker", "tradeDate"] } },
  { name: "hist_earnings", description: "Get earnings history", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  { name: "hist_splits", description: "Get stock split history", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  { name: "hist_ivrank", description: "Get historical IV rank", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" }, tradeDate: { type: "string" }, fields: { type: "string" } }, required: ["ticker", "tradeDate"] } },
  { name: "live_intraday_strikes_chain", description: "Get live 1-min intraday chain", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  { name: "live_intraday_monies_implied", description: "Get live 1-min implied monies", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  { name: "live_intraday_summaries", description: "Get live 1-min summaries", inputSchema: { type: "object" as const, properties: { ticker: { type: "string" } }, required: ["ticker"] } },
];

const ENDPOINT_MAP: Record<string, string> = {
  live_strikes: "/live/strikes",
  live_strikes_by_expiry: "/live/strikes/monthly",
  live_strikes_by_opra: "/live/strikes/options",
  live_expirations: "/live/expirations",
  live_monies_implied: "/live/monies/implied",
  live_monies_forecast: "/live/monies/forecast",
  live_summaries: "/live/summaries",
  tickers: "/tickers",
  strikes: "/strikes",
  monies_implied: "/monies/implied",
  monies_forecast: "/monies/forecast",
  summaries: "/summaries",
  cores: "/cores",
  ivrank: "/ivrank",
  hist_strikes: "/hist/strikes",
  hist_monies_implied: "/hist/monies/implied",
  hist_summaries: "/hist/summaries",
  hist_cores: "/hist/cores",
  hist_dailies: "/hist/dailies",
  hist_hvs: "/hist/hvs",
  hist_earnings: "/hist/earnings",
  hist_splits: "/hist/splits",
  hist_ivrank: "/hist/ivrank",
  live_intraday_strikes_chain: "/live/one-minute/strikes/chain",
  live_intraday_monies_implied: "/live/one-minute/monies/implied",
  live_intraday_summaries: "/live/one-minute/summaries",
};

export function createOratsMcpServer(): Server {
  const server = new Server(
    { name: "orats-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const endpoint = ENDPOINT_MAP[name];
      if (!endpoint) {
        throw new Error(`Unknown tool: ${name}`);
      }
      const a = args as Record<string, string>;
      const result = await makeRequest(endpoint, a);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  });

  return server;
}
