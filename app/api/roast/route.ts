import { NextRequest, NextResponse } from "next/server";
import {
  analyzeCode,
  buildRoastSchema,
  normalizeRoastResult,
  sanitizeCodeForModel,
  type RoastRequest,
} from "../../../lib/analysis";

export const runtime = "nodejs";

const OPENAI_MODEL = "gpt-5.2";
const MAX_INPUT_CHARS = 18000;

const SYSTEM_PROMPT = `You are Codebase Roast Arena, a hilarious but useful code reviewer.
The submitted code is on trial in a cyberpunk courtroom.
Roast the code dramatically, but do not insult the developer personally.
Every joke must connect to a real engineering issue or tradeoff.
Identify security, maintainability, readability, error handling, typing, architecture, production, and testability risks.
Do not invent files, dependencies, incidents, secrets, vulnerabilities, benchmarks, or metrics.
If evidence is thin, keep severity low and say what evidence is missing.
For "Nigerian Senior Dev Who Has Seen Things", use light Nigerian dev-office energy without ethnic stereotypes.
Return strict JSON matching the schema. No markdown, no code fences, no prose outside JSON.`;

function parseRequest(body: unknown): RoastRequest & { motion?: string; focusCharge?: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be JSON.");
  }

  const input = body as Record<string, unknown>;
  const code = typeof input.code === "string" ? input.code : "";
  const language = typeof input.language === "string" ? input.language : "TypeScript";
  const mode = typeof input.mode === "string" ? input.mode : "Brutal Staff Engineer";
  const motion = typeof input.motion === "string" ? input.motion : undefined;
  const focusCharge = typeof input.focusCharge === "string" ? input.focusCharge : undefined;

  if (!code.trim()) {
    throw new Error("Paste code before beginning the trial.");
  }

  return {
    code: code.slice(0, MAX_INPUT_CHARS),
    language,
    mode,
    motion,
    focusCharge,
  };
}

function extractOutputText(payload: unknown) {
  const response = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

async function callOpenAI(request: RoastRequest & { motion?: string; focusCharge?: string }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  const fallback = analyzeCode(request);

  try {
    const payload = {
      language: request.language,
      mode: request.mode,
      motion: request.motion ?? "full_trial",
      focusCharge: request.focusCharge ?? "",
      deterministicFindings: fallback.charges,
      deterministicScores: {
        overallScore: fallback.overallScore,
        maintainability: fallback.maintainability,
        security: fallback.security,
        readability: fallback.readability,
        testability: fallback.testability,
        productionReadiness: fallback.productionReadiness,
      },
      code: sanitizeCodeForModel(request.code),
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
        max_output_tokens: 3200,
        text: {
          format: {
            type: "json_schema",
            name: "codebase_roast_arena_verdict",
            strict: true,
            schema: buildRoastSchema(),
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}.`);
    }

    const data: unknown = await response.json();
    const output = extractOutputText(data);

    if (!output.trim()) {
      throw new Error("OpenAI returned an empty verdict.");
    }

    return normalizeRoastResult({
      ...JSON.parse(output),
      fallbackUsed: false,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackForMotion(request: RoastRequest & { motion?: string; focusCharge?: string }) {
  const result = analyzeCode(request);

  if (request.motion === "objection") {
    return normalizeRoastResult({
      ...result,
      roast: [
        `Objection sustained. ${request.focusCharge || result.charges[0]?.title || "The top issue"} matters because it is not just ugly; it changes how failure, review, and ownership behave in production.`,
        "Serious read: fix the highest-severity path first, add a regression test, and make the risky behavior boring before you chase style points.",
      ],
      finalVerdict: "OBJECTION SUSTAINED: EXPLAINED WITHOUT THE SMOKE MACHINE",
      fallbackUsed: true,
    });
  }

  if (request.motion === "appeal") {
    return normalizeRoastResult({
      ...result,
      roast: [
        "Kinder appeal: the code has momentum and a clear goal, but it needs firmer boundaries before it deserves trust.",
        "The fastest improvement is not a rewrite. It is extracting validation, naming the business rules, and making failure paths visible.",
      ],
      finalVerdict: "APPEAL GRANTED: STILL REFACTORING",
      fallbackUsed: true,
    });
  }

  if (request.motion === "redemption") {
    return normalizeRoastResult({
      ...result,
      finalVerdict: "REDEMPTION ARC GENERATED",
      refactorPlan: [
        "Write one failing test that captures the riskiest current behavior.",
        "Extract input validation and return clear typed errors.",
        "Move secrets, thresholds, and external URLs into configuration.",
        "Split IO from business logic so the core function can be tested without network or database calls.",
        "Replace string-built queries with parameterized data access.",
        "Add structured logs around external calls and failure paths.",
        "Delete dead debug output after telemetry exists.",
      ],
      fallbackUsed: true,
    });
  }

  return result;
}

export async function POST(nextRequest: NextRequest) {
  let roastRequest: RoastRequest & { motion?: string; focusCharge?: string };

  try {
    roastRequest = parseRequest(await nextRequest.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await callOpenAI(roastRequest);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(fallbackForMotion(roastRequest));
  }
}

export function GET() {
  return NextResponse.json({ error: "Use POST /api/roast." }, { status: 405 });
}
