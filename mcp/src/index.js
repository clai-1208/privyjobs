#!/usr/bin/env node
/**
 * PrivyJobs MCP server (stdio)
 *
 * Landing chain tools for external AIs:
 * create_job → clarify (1 round) → set_settlement (off-platform) → deliver → accept / return_job / list / get
 *
 * Platform does NOT custody funds. Sell workflows, private channels, and per-order
 * authorized data slices — NOT dumping a knowledge base into the platform or a model.
 * Points are reputation garnish only, not currency.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as jobs from "./jobs.js";
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
