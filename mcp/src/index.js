#!/usr/bin/env node
/**
 * PrivyJobs MCP server (stdio)
 *
 * Landing chain tools for external AIs:
 * find_sellers / match_sellers → get_quote → create_job → clarify → set_settlement → deliver → accept
 *
 * Platform does NOT custody funds. Sell workflows, private channels, and per-order
 * authorized data slices — NOT dumping a knowledge base into the platform or a model.
 * Points are reputation garnish only, not currency.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as jobs from "./jobs.js";
import * as discover from "./discover.js";
import * as escrowTools from "./escrow.js";
import { hasRemote } from "./api.js";

const DISCLAIMER =
  "PrivyJobs: free matching + on-platform order log. Settlement is off-platform (WeChat/Alipay/other). " +
  "The platform does NOT custody funds. Sell repeatable workflows, private channels models can't enter, " +
  "and per-order authorized data slices — NOT dumping a KB into the platform or a model. Points ≠ money.";

function textResult(obj) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
  };
}

function errResult(e) {
  const payload = {
    ok: false,
    error: e.message || String(e),
    ...(e.extra || {}),
    disclaimer: DISCLAIMER,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

async function wrap(fn, args) {
  try {
    const out = await fn(args || {});
    return textResult({ ...out, disclaimer: DISCLAIMER });
  } catch (e) {
    return errResult(e);
  }
}

const server = new McpServer({
  name: "privyjobs",
  version: "0.1.0",
});

server.registerTool(
  "create_job",
  {
    title: "Create job",
    description:
      DISCLAIMER +
      " Create a buyer intent / order log (reference points optional, not currency).",
    inputSchema: {
      title: z.string().describe("Job title"),
      skill: z.string().describe("Capability / workflow domain to rent"),
      brief: z.string().describe("Brief: inputs, constraints, expected output"),
      points: z
        .number()
        .optional()
        .describe("Optional reference points (reputation garnish only, not fiat)"),
      accept: z.string().optional().describe("Accept criteria"),
      channel: z.string().optional().describe("Delivery preference"),
    },
  },
  async (args) => wrap(jobs.createJob, args)
);

server.registerTool(
  "clarify",
  {
    title: "Clarify / lock",
    description:
      DISCLAIMER +
      " One clarify round then lock. Buyer answers a short question list — no open KB fishing.",
    inputSchema: {
      id: z.string().describe("Job id"),
      role: z
        .enum(["buyer", "seller"])
        .optional()
        .describe("Who is acting; seller lock advances to making"),
      action: z
        .enum(["lock", "note"])
        .optional()
        .describe("lock = end clarify round (default)"),
      buyer_answers: z.string().optional().describe("Buyer answers to the question list"),
    },
  },
  async (args) => wrap(jobs.clarify, args)
);

server.registerTool(
  "set_settlement",
  {
    title: "Agree off-platform settlement",
    description:
      DISCLAIMER +
      " Record settlement method + both-party confirms. mark_agreed requires method and both confirms. " +
      "Does NOT move money — WeChat/Alipay/etc. stay off-platform.",
    inputSchema: {
      id: z.string().describe("Job id"),
      method: z
        .enum(["wechat", "alipay", "other", "international_tbd"])
        .optional()
        .describe("Settlement method (off-platform)"),
      buyer_confirmed: z
        .boolean()
        .optional()
        .describe("Buyer confirms off-platform settle agreement"),
      seller_confirmed: z
        .boolean()
        .optional()
        .describe("Seller confirms off-platform settle agreement"),
      mark_agreed: z
        .boolean()
        .optional()
        .describe(
          "If true (or both confirms + method set), mark settlement agreed — required before deliver"
        ),
    },
  },
  async (args) => wrap(jobs.setSettlement, args)
);

server.registerTool(
  "deliver",
  {
    title: "Deliver result package",
    description:
      DISCLAIMER +
      " Submit structured result package. Requires settlement agreed first. Execution stays on the seller machine.",
    inputSchema: {
      id: z.string().describe("Job id"),
      summary: z.string().describe("Delivery summary"),
      artifacts: z.string().describe("Artifact list"),
      accept_check: z.string().describe("Accept criteria check"),
      attachments: z.string().optional().describe("Optional attachment names"),
    },
  },
  async (args) => wrap(jobs.deliver, args)
);

server.registerTool(
  "accept",
  {
    title: "Accept delivery",
    description:
      DISCLAIMER +
      " Buyer accepts the result package. Updates order status only — no platform payout.",
    inputSchema: {
      id: z.string().describe("Job id"),
    },
  },
  async (args) => wrap(jobs.acceptJob, args)
);

server.registerTool(
  "return_job",
  {
    title: "Close / return intent",
    description:
      DISCLAIMER +
      " Close an intent (rework fail / overdue). No platform refund — funds were never custodied.",
    inputSchema: {
      id: z.string().describe("Job id"),
      reason: z.string().optional().describe("Close reason"),
    },
  },
  async (args) => wrap(jobs.returnJob, args)
);

server.registerTool(
  "list_jobs",
  {
    title: "List jobs",
    description: DISCLAIMER + " List order logs (optional status filter).",
    inputSchema: {
      status: z
        .enum(["clarify", "making", "accept", "done", "returned"])
        .optional()
        .describe("Filter by status"),
      limit: z.number().optional().describe("Max rows (default 50)"),
    },
  },
  async (args) => wrap(jobs.listJobs, args)
);



server.registerTool(
  "create_escrow",
  {
    title: "Create Escrow.com transaction",
    description:
      DISCLAIMER +
      " Create/link an Escrow.com (or mock) transaction for international settlement. Platform NEVER holds principal. Without API keys returns mock esc_mock_* id.",
    inputSchema: {
      job_id: z.string().optional().describe("Optional local job id to attach"),
      amount: z.number().optional().describe("Escrow amount (third-party)"),
      currency: z.string().optional().describe("Currency code, default USD"),
      description: z.string().optional().describe("Transaction description"),
    },
  },
  async (args) => wrap(escrowTools.createEscrow, args)
);

server.registerTool(
  "get_escrow_status",
  {
    title: "Get Escrow status",
    description:
      DISCLAIMER +
      " Read escrow_status for an escrow_tx_id (draft|funded|delivered|accepted|cancelled). Platform never holds principal.",
    inputSchema: {
      id: z.string().describe("escrow_tx_id"),
    },
  },
  async (args) => wrap(escrowTools.getEscrowStatus, args)
);

server.registerTool(
  "find_sellers",
  {
    title: "Find sellers",
    description:
      DISCLAIMER +
      " Rank sellers from the public catalog by domain-token overlap on need/skill/brief. Returns id, name, kind, domains hit, score, one-line about — NOT a full knowledge-base dump.",
    inputSchema: {
      need: z
        .string()
        .optional()
        .describe("Free-text need (used if skill/brief omitted)"),
      skill: z.string().optional().describe("Capability / workflow domain"),
      brief: z.string().optional().describe("Job brief"),
      title: z.string().optional().describe("Optional title"),
      accept: z.string().optional().describe("Optional accept criteria"),
      limit: z.number().optional().describe("Max matches (default 5)"),
    },
  },
  async (args) => wrap(discover.findSellers, args)
);

server.registerTool(
  "match_sellers",
  {
    title: "Match sellers",
    description:
      DISCLAIMER +
      " Alias of find_sellers — same domain-token scorer as worker/src/match.js / site catalog.",
    inputSchema: {
      need: z.string().optional().describe("Free-text need"),
      skill: z.string().optional().describe("Capability / workflow domain"),
      brief: z.string().optional().describe("Job brief"),
      title: z.string().optional().describe("Optional title"),
      accept: z.string().optional().describe("Optional accept criteria"),
      limit: z.number().optional().describe("Max matches (default 5)"),
    },
  },
  async (args) => wrap(discover.matchSellers, args)
);

server.registerTool(
  "get_quote",
  {
    title: "Get quote stub",
    description:
      DISCLAIMER +
      " Structured quote stub for a catalog seller_id + job summary: price_hint (points demoted / free early / optional off-platform amount), turnaround, settlement_methods, what_is_sold. Not a fiat commitment; platform does not custody funds.",
    inputSchema: {
      seller_id: z.string().describe("Catalog seller id (e.g. R-07)"),
      job_summary: z
        .string()
        .optional()
        .describe("Short job summary / brief for the quote context"),
      brief: z.string().optional().describe("Alias of job_summary"),
      need: z.string().optional().describe("Alias of job_summary"),
    },
  },
  async (args) => wrap(discover.getQuote, args)
);

server.registerTool(
  "get_job",
  {
    title: "Get job",
    description: DISCLAIMER + " Fetch one order log by id.",
    inputSchema: {
      id: z.string().describe("Job id"),
    },
  },
  async (args) => wrap(jobs.getJob, args)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is MCP JSON-RPC
  console.error(
    "[privyjobs-mcp] ready · stdio · " +
      (hasRemote()
        ? "PRIVYJOBS_API_BASE=" + process.env.PRIVYJOBS_API_BASE
        : "local .data/") +
      " · no fund custody"
  );
}

main().catch((err) => {
  console.error("[privyjobs-mcp] fatal", err);
  process.exit(1);
});
