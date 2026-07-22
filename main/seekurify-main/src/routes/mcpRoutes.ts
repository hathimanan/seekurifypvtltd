import express from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import Password from "../models/Password.js";
import { hibpCheckPasswordPrefix, checkUserEmailBreaches } from "../api/hibp.js";
import { answerSecurityQuestion } from "./bot.ts";

const mcpRouter = express.Router();

// ── Auth ─────────────────────────────────────────────────────────────────────
// Same pattern duplicated in every other route file in this codebase
// (auth.js, hibp.js, passwords.js, dashboard.js) — verified before the MCP
// server/transport is ever constructed, so an unauthenticated or invalid
// request never reaches MCP handling at all.
function authenticateToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err: any = new Error("Missing or invalid Authorization header");
    err.status = 401;
    throw err;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    return decoded._id;
  } catch {
    const err: any = new Error("Invalid or expired token");
    err.status = 403;
    throw err;
  }
}

// ── Tool registration ───────────────────────────────────────────────────────
// Registered fresh per request, closing over the authenticated userId for
// that request — matches this server's stateless, per-request JWT model
// (no MCP session tracking, consistent with how every other route works and
// with this app's single-serverless-function deployment).
function registerSeekurifyTools(server: McpServer, ctx: { userId: string }) {
  const { userId } = ctx;

  server.registerTool(
    "check_password_breach",
    {
      description:
        "Check whether a password appears in the HaveIBeenPwned breached-password " +
        "database, using k-anonymity — only a 5-character SHA-1 prefix is sent, " +
        "never the full password or hash. Returns candidate suffix+count pairs; " +
        "the caller must locally compute the full uppercase SHA-1 hash of the " +
        "password and match the remaining 35 hex characters against a returned " +
        "suffix to determine an actual hit.",
      inputSchema: {
        hashPrefix: z
          .string()
          .regex(/^[A-Fa-f0-9]{5}$/)
          .describe("First 5 hex characters of the uppercase SHA-1 hash of the password to check"),
      },
    },
    async ({ hashPrefix }: { hashPrefix: string }) => {
      const suffixes = await hibpCheckPasswordPrefix(hashPrefix);
      return { content: [{ type: "text" as const, text: JSON.stringify({ suffixes }) }] };
    }
  );

  server.registerTool(
    "check_email_breach",
    {
      description:
        "Check the authenticated user's own account email against " +
        "HaveIBeenPwned's breached-account database. Takes no parameters — " +
        "always scoped to the caller's own email, cannot probe third-party " +
        "addresses. Returns an error if the server's HIBP_API_KEY isn't configured.",
      inputSchema: {},
    },
    async () => {
      try {
        const breaches = await checkUserEmailBreaches(userId);
        return { content: [{ type: "text" as const, text: JSON.stringify({ breaches }) }] };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_vault_entries",
    {
      description:
        "List metadata for the authenticated user's saved password-vault " +
        "entries — website, username, category, financial flag, notes, " +
        "breach/risk hygiene info, and expiry. NEVER returns the password " +
        "field itself, encrypted or otherwise. For reasoning about vault " +
        "hygiene and organization only.",
      inputSchema: {},
    },
    async () => {
      // Explicit allowlist projection — fails safe. A denylist like
      // .select('-password') would silently expose any new sensitive field
      // added to the schema later unless the exclude list is remembered to
      // be updated every time. The password field is never fetched here.
      const raw = await Password.find({ userId })
        .select(
          "website username category isFinancial notes createdAt expiresAt " +
            "riskScore riskLevel isBreached breachCount quarantined quarantineReason"
        )
        .lean();

      const now = new Date();
      const entries = raw.map((p: any) => ({
        ...p,
        isExpired: p.expiresAt ? now > new Date(p.expiresAt) : false,
        daysLeft: p.expiresAt
          ? Math.ceil((new Date(p.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify({ entries }) }] };
    }
  );

  server.registerTool(
    "ask_security_assistant",
    {
      description:
        "Ask Seekurify's built-in cybersecurity assistant a question and get " +
        "a formatted answer, using the same knowledge base and AI provider " +
        "(Anthropic/Google/LiteLLM, whichever is configured) as the in-app " +
        "Security Chatbot.",
      inputSchema: {
        userQuestion: z.string().min(1).describe("The security question to ask"),
        userLevel: z.string().optional().describe("Beginner | Intermediate | Advanced"),
        format: z
          .enum(["bullet", "numbered", "paragraph", "concise", "detailed"])
          .optional()
          .describe("Desired answer format"),
      },
    },
    async ({ userQuestion, userLevel, format }: { userQuestion: string; userLevel?: string; format?: string }) => {
      try {
        const answer = await answerSecurityQuestion({ userQuestion, userLevel, format });
        return { content: [{ type: "text" as const, text: JSON.stringify(answer) }] };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }],
          isError: true,
        };
      }
    }
  );
}

// ── Route (stateless Streamable HTTP) ───────────────────────────────────────
mcpRouter.post("/", async (req: Request, res: Response) => {
  let userId: string;
  try {
    userId = authenticateToken(req);
  } catch (err: any) {
    return res.status(err.status || 403).json({ error: err.message });
  }

  const server = new McpServer({ name: "seekurify-mcp", version: "1.0.0" }, { capabilities: {} });
  registerSeekurifyTools(server, { userId });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const methodNotAllowed = (req: Request, res: Response) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });

mcpRouter.get("/", methodNotAllowed);
mcpRouter.delete("/", methodNotAllowed);

export default mcpRouter;
