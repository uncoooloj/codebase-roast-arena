export type Severity = "low" | "medium" | "high" | "critical";

export type Charge = {
  title: string;
  severity: Severity;
  explanation: string;
  evidence?: string;
  fix: string;
};

export type RoastResult = {
  verdict: string;
  overallScore: number;
  maintainability: number;
  security: number;
  readability: number;
  testability: number;
  productionReadiness: number;
  roast: string[];
  charges: Charge[];
  evidence: string[];
  refactorPlan: string[];
  cleanerVersion: string;
  teamDiagnosis: string;
  finalVerdict: string;
  fallbackUsed: boolean;
};

export type RoastRequest = {
  code: string;
  language: string;
  mode: string;
};

const MAX_CODE_CHARS = 18000;
const LINE_LIMIT = 220;

const severityPenalty: Record<Severity, number> = {
  low: 5,
  medium: 9,
  high: 15,
  critical: 24,
};

export const languages = ["TypeScript", "JavaScript", "Python", "Go", "PHP"] as const;

export const roastModes = [
  "Brutal Staff Engineer",
  "Security Auditor",
  "Production Incident Commander",
  "YC Investor Due Diligence",
  "Polite Senior Engineer",
  "Nigerian Senior Dev Who Has Seen Things",
] as const;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function capText(value: unknown, max = 1200) {
  return String(value ?? "")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, max);
}

function countMatches(code: string, pattern: RegExp) {
  return code.match(pattern)?.length ?? 0;
}

function getMaxBraceDepth(code: string) {
  let depth = 0;
  let max = 0;

  for (const char of code) {
    if (char === "{") {
      depth += 1;
      max = Math.max(max, depth);
    }

    if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
  }

  return max;
}

function repeatedLines(lines: string[]) {
  const counts = new Map<string, number>();

  for (const line of lines) {
    const normalized = line.trim();
    if (normalized.length < 12) continue;
    if (/^[{}()[\],;]+$/.test(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()].filter(([, count]) => count > 1);
}

function tooManyParams(code: string) {
  const matches = [...code.matchAll(/(?:function\s+\w+|\w+\s*=\s*(?:async\s*)?\(|(?:async\s+)?function\s*\w*)\s*\(([^)]*)\)/g)];
  return matches.some((match) => {
    const params = match[1]
      .split(",")
      .map((param) => param.trim())
      .filter(Boolean);
    return params.length >= 5;
  });
}

function addCharge(charges: Charge[], charge: Charge) {
  if (!charges.some((existing) => existing.title === charge.title)) {
    charges.push(charge);
  }
}

function splitEvidenceUnits(code: string) {
  const lines = code.split(/\r?\n/);
  const units: Array<{ name: string; code: string; lines: string[]; meaningfulLines: string[] }> = [];
  let currentName = "pasted snippet";
  let currentLines: string[] = [];

  function pushUnit() {
    if (!currentLines.some((line) => line.trim())) return;
    units.push({
      name: currentName,
      code: currentLines.join("\n"),
      lines: currentLines,
      meaningfulLines: currentLines.filter((line) => line.trim().length > 0),
    });
  }

  for (const line of lines) {
    const fileHeader = line.match(/^\/\/\s+[\w.-]+\/[\w.-]+\/(.+)$/);
    if (fileHeader) {
      pushUnit();
      currentName = fileHeader[1];
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  pushUnit();

  return units.length ? units : [{ name: "pasted snippet", code, lines, meaningfulLines: lines.filter((line) => line.trim().length > 0) }];
}

export function sanitizeCodeForModel(code: string) {
  return code
    .slice(0, MAX_CODE_CHARS)
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "sk-REDACTED")
    .replace(/(["']?api[_-]?key["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, "$1REDACTED$3")
    .replace(/(["']?(secret|token|password)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, "$1REDACTED$4")
    .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, "PRIVATE_KEY_REDACTED");
}

export function analyzeCode(request: RoastRequest): RoastResult {
  const code = request.code.slice(0, MAX_CODE_CHARS);
  const language = request.language || "TypeScript";
  const mode = request.mode || "Brutal Staff Engineer";
  const lines = code.split(/\r?\n/);
  const evidenceUnits = splitEvidenceUnits(code);
  const largestUnit = evidenceUnits.reduce((largest, unit) => (unit.meaningfulLines.length > largest.meaningfulLines.length ? unit : largest), evidenceUnits[0]);
  const charges: Charge[] = [];
  const evidence: string[] = [];

  const ifCount = countMatches(code, /\bif\s*\(/g);
  const awaitCount = countMatches(code, /\bawait\b/g);
  const tryCount = countMatches(code, /\btry\s*{/g);
  const consoleCount = countMatches(code, /\b(console\.(log|debug|warn)|print\(|fmt\.Print|var_dump\()/g);
  const todoCount = countMatches(code, /\b(TODO|FIXME|HACK)\b/gi);
  const secretCount = countMatches(code, /(apiKey|api_key|secret|password|token|sk-|PRIVATE_KEY)/gi);
  const maxDepth = getMaxBraceDepth(code);
  const repeats = repeatedLines(lines);
  const magicNumbers = countMatches(code, /(?<![\w.])(?:[2-9]\d{1,}|100|200|400|401|403|404|500|1000|10000)(?![\w.])/g);
  const anyCount = countMatches(code, /:\s*any\b|\bas\s+any\b|<any>/g);
  const emptyCatch = /catch\s*\([^)]*\)\s*{\s*(?:\/\/[^\n]*)?\s*}/.test(code);
  const sqlConcat = /(SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,220}(\+|\$\{)/i.test(code);
  const boolParams = /\((?:[^)]*,\s*)?(?:is|has|should|flag|enabled|active)\w*\s*:\s*boolean(?:\s*,[^)]*)?\)/i.test(code);
  const callbacks = countMatches(code, /=>\s*{[\s\S]{0,220}=>\s*{/g) + countMatches(code, /function\s*\([^)]*\)\s*{[\s\S]{0,220}function\s*\(/g);
  const mixedResponsibilities = [
    /(db\.|database|query\(|SELECT|INSERT|UPDATE|DELETE)/i,
    /(fetch\(|axios|http|request|response|req\.|res\.)/i,
    /(validate|schema|required|body|params)/i,
    /(payment|checkout|invoice|business|price|total|amount)/i,
  ].filter((pattern) => pattern.test(code)).length >= 3;

  if (largestUnit.meaningfulLines.length > LINE_LIMIT) {
    addCharge(charges, {
      title: "Large file smell",
      severity: "high",
      explanation: "One imported file is carrying enough surface area that reviewers will miss important behavior.",
      evidence: `${largestUnit.name}: ${largestUnit.meaningfulLines.length} non-empty lines`,
      fix: "Split by responsibility: validation, orchestration, IO, and presentation should not all live in one file.",
    });
  }

  if (largestUnit.lines.length > 60 && /function|=>|def |func /.test(largestUnit.code)) {
    addCharge(charges, {
      title: "Very long function",
      severity: "high",
      explanation: "Long functions hide branches, side effects, and error cases from reviewers.",
      evidence: `${largestUnit.name}: ${largestUnit.lines.length} lines in the largest imported unit`,
      fix: "Extract validation, calculation, persistence, external API calls, and response mapping into named helpers.",
    });
  }

  if (ifCount >= 6) {
    addCharge(charges, {
      title: "Too many branches",
      severity: ifCount >= 10 ? "high" : "medium",
      explanation: "Every conditional creates another path that needs a test and a human memory slot.",
      evidence: `${ifCount} if statements`,
      fix: "Use guard clauses, strategy maps, and extracted decision helpers to flatten the control flow.",
    });
  }

  if (maxDepth >= 5) {
    addCharge(charges, {
      title: "Nested control-flow bunker",
      severity: maxDepth >= 7 ? "high" : "medium",
      explanation: "Deep nesting makes the happy path hard to see and the edge paths easy to forget.",
      evidence: `brace depth ${maxDepth}`,
      fix: "Return early for invalid states, then keep the core operation at one or two indentation levels.",
    });
  }

  if (consoleCount >= 2) {
    addCharge(charges, {
      title: "Debug prints as observability",
      severity: "low",
      explanation: "Console logs are useful while panicking locally, but they do not become production telemetry by enthusiasm.",
      evidence: `${consoleCount} debug print calls`,
      fix: "Replace with structured logging, request IDs, and actionable events.",
    });
  }

  if (todoCount > 0) {
    addCharge(charges, {
      title: "TODOs in the blast zone",
      severity: todoCount >= 3 ? "medium" : "low",
      explanation: "Deferred work near core logic usually becomes institutional memory with syntax highlighting.",
      evidence: `${todoCount} TODO/FIXME/HACK marker${todoCount === 1 ? "" : "s"}`,
      fix: "Move TODOs into tracked tasks and remove vague comments from production paths.",
    });
  }

  if (secretCount > 0) {
    addCharge(charges, {
      title: "Hardcoded secret risk",
      severity: "critical",
      explanation: "Credentials in source code are a security incident waiting for a commit history.",
      evidence: "secret-like token or key name detected",
      fix: "Move secrets to environment variables or a secret manager and rotate anything already exposed.",
    });
  }

  if (repeats.length > 0) {
    addCharge(charges, {
      title: "Copy-paste archaeology",
      severity: repeats.length >= 4 ? "medium" : "low",
      explanation: "Repeated lines mean future changes will be applied once, forgotten twice, and debugged at midnight.",
      evidence: `${repeats.length} repeated line pattern${repeats.length === 1 ? "" : "s"}`,
      fix: "Extract duplicated behavior into helpers, data maps, or shared components.",
    });
  }

  if (magicNumbers >= 4) {
    addCharge(charges, {
      title: "Magic numbers without a witness",
      severity: "low",
      explanation: "Undocumented constants turn business rules into numerology.",
      evidence: `${magicNumbers} numeric literals`,
      fix: "Name thresholds and status codes so future readers know whether they are policy, protocol, or vibes.",
    });
  }

  if (/typescript/i.test(language) && anyCount > 0) {
    addCharge(charges, {
      title: "TypeScript on unpaid leave",
      severity: anyCount >= 3 ? "high" : "medium",
      explanation: "`any` removes the compiler from the witness stand right when the code needs it most.",
      evidence: `${anyCount} any usage${anyCount === 1 ? "" : "s"}`,
      fix: "Define request, response, domain, and dependency interfaces instead of opting out of type safety.",
    });
  }

  if (emptyCatch) {
    addCharge(charges, {
      title: "Empty catch block",
      severity: "high",
      explanation: "The error handling strategy appears to be making the error feel unseen.",
      evidence: "catch block with no meaningful handling",
      fix: "Log with context, return a safe response, and preserve enough detail for debugging.",
    });
  }

  if (tooManyParams(code)) {
    addCharge(charges, {
      title: "Parameter parade",
      severity: "medium",
      explanation: "A function with too many arguments is asking every caller to remember the same fragile ceremony.",
      fix: "Pass a typed options object or split the function into smaller operations.",
    });
  }

  if (sqlConcat) {
    addCharge(charges, {
      title: "SQL string concatenation",
      severity: "critical",
      explanation: "Building SQL with raw values is how user input gets promoted to database administrator.",
      evidence: "SQL keyword near string concatenation/interpolation",
      fix: "Use parameterized queries or an ORM query builder.",
    });
  }

  if (awaitCount >= 2 && tryCount === 0) {
    addCharge(charges, {
      title: "Async without a parachute",
      severity: "medium",
      explanation: "Async calls without visible error handling turn transient failures into confusing user experiences.",
      evidence: `${awaitCount} await calls and no try block`,
      fix: "Wrap IO in explicit error handling and return domain-specific failures.",
    });
  }

  if (boolParams) {
    addCharge(charges, {
      title: "Boolean parameter smell",
      severity: "low",
      explanation: "Boolean flags often mean one function is pretending to be two behaviors.",
      fix: "Use named option objects or separate functions for separate flows.",
    });
  }

  if (callbacks >= 2) {
    addCharge(charges, {
      title: "Callback nesting spiral",
      severity: "medium",
      explanation: "Nested callbacks make sequencing and failure paths harder to reason about.",
      fix: "Flatten with async/await, named functions, or a small orchestration layer.",
    });
  }

  if (mixedResponsibilities) {
    addCharge(charges, {
      title: "Mixed responsibilities",
      severity: "high",
      explanation: "Database work, HTTP handling, validation, and business logic are all arguing in the same room.",
      evidence: "IO, validation, and domain logic detected together",
      fix: "Separate controller, service, repository, and validation concerns.",
    });
  }

  if (charges.length === 0) {
    addCharge(charges, {
      title: "Mostly acquitted",
      severity: "low",
      explanation: "The snippet is tidy enough that the court had to squint to find drama.",
      fix: "Keep the structure, add tests around important edge cases, and document the highest-risk assumptions.",
    });
  }

  for (const charge of charges.slice(0, 6)) {
    evidence.push(`${charge.title}: ${charge.evidence ?? charge.explanation}`);
  }

  const penalty = charges.reduce((sum, charge) => sum + severityPenalty[charge.severity], 0);
  const overallScore = clamp(100 - penalty);
  const securityPenalty = charges.filter((charge) => /secret|sql|security|auth|injection/i.test(charge.title + charge.explanation)).reduce((sum, charge) => sum + severityPenalty[charge.severity], 0);
  const maintainabilityPenalty = charges.filter((charge) => /long|branch|nested|mixed|copy|parameter|boolean/i.test(charge.title)).reduce((sum, charge) => sum + severityPenalty[charge.severity], 0);
  const readabilityPenalty = charges.filter((charge) => /magic|nested|console|copy|branch/i.test(charge.title)).reduce((sum, charge) => sum + severityPenalty[charge.severity], 0);
  const testabilityPenalty = charges.filter((charge) => /branch|mixed|async|long|parameter/i.test(charge.title)).reduce((sum, charge) => sum + severityPenalty[charge.severity], 0);
  const readinessPenalty = penalty + (emptyCatch ? 8 : 0) + (secretCount > 0 ? 12 : 0);

  const roast = buildRoasts(charges, mode);
  const finalVerdict = verdictForScore(overallScore, charges);

  return normalizeRoastResult({
    verdict: finalVerdict,
    overallScore,
    maintainability: clamp(100 - maintainabilityPenalty),
    security: clamp(100 - securityPenalty),
    readability: clamp(100 - readabilityPenalty),
    testability: clamp(100 - testabilityPenalty),
    productionReadiness: clamp(100 - readinessPenalty),
    roast,
    charges,
    evidence,
    refactorPlan: buildRefactorPlan(charges),
    cleanerVersion: buildCleanerVersion(language),
    teamDiagnosis: teamDiagnosis(mode, charges, overallScore),
    finalVerdict,
    fallbackUsed: true,
  });
}

function buildRoasts(charges: Charge[], mode: string) {
  const titles = charges.map((charge) => charge.title).join(" ");
  const roasts = [
    "This code walked into the arena and immediately asked where the waiver forms were.",
    "The architecture is giving group project energy: everyone contributed, nobody coordinated.",
  ];

  if (/Security Auditor/.test(mode) || /secret|SQL/i.test(titles)) {
    roasts.push("Security has entered the chat, seen the hardcoded keys, and quietly started drafting the incident review.");
  }

  if (/Production Incident/.test(mode) || /Empty catch|Async/i.test(titles)) {
    roasts.push("At 2am this will fail silently, page nobody, and still somehow become everyone's problem.");
  }

  if (/Investor/.test(mode)) {
    roasts.push("The diligence memo says the team has product urgency, but the codebase needs governance before Series A.");
  }

  if (/Polite/.test(mode)) {
    roasts.push("There is a workable idea here, but it would benefit from clearer boundaries and less suspense.");
  }

  if (/Nigerian/.test(mode)) {
    roasts.push("My brother, this code is trying, but production will ask questions it cannot answer.");
  }

  if (/any/i.test(titles)) {
    roasts.push("The use of `any` has turned TypeScript into JavaScript with a gym membership.");
  }

  if (/Nested|branches/i.test(titles)) {
    roasts.push("The nesting here suggests the code is hiding from accountability.");
  }

  if (/console/i.test(titles)) {
    roasts.push("There are enough debug prints here to qualify as observability in 2012.");
  }

  return roasts.slice(0, 7);
}

function buildRefactorPlan(charges: Charge[]) {
  const plan = [
    "Start with guard clauses so invalid input exits before the main path begins.",
    "Extract validation into a dedicated function with typed inputs and explicit failure messages.",
    "Move business rules into a service function that has no HTTP or database knowledge.",
    "Replace hardcoded credentials and thresholds with named configuration.",
    "Add tests around success, invalid input, external failure, and security-sensitive paths.",
  ];

  if (charges.some((charge) => /SQL/.test(charge.title))) {
    plan.splice(2, 0, "Replace string-built SQL with parameterized queries before touching anything else.");
  }

  if (charges.some((charge) => /Mixed/.test(charge.title))) {
    plan.push("Split controller, service, repository, and response mapping into separate modules.");
  }

  return plan.slice(0, 7);
}

function buildCleanerVersion(language: string) {
  if (/python/i.test(language)) {
    return `async def checkout(request, payment_client, transaction_repo):\n    payload = validate_checkout_payload(request.json)\n    total = calculate_total(payload[\"items\"])\n\n    transaction = await transaction_repo.create_pending(payload[\"user_id\"], total)\n\n    try:\n        payment = await payment_client.charge(amount=total, card=payload[\"card\"])\n    except PaymentError as error:\n        await transaction_repo.mark_failed(transaction.id, str(error))\n        return {\"ok\": False, \"error\": \"payment failed\"}, 502\n\n    await transaction_repo.mark_success(transaction.id, payment.id)\n    return {\"ok\": True, \"total\": total, \"transactionId\": transaction.id}`;
  }

  if (/go/i.test(language)) {
    return `func Checkout(ctx context.Context, req CheckoutRequest, payments PaymentClient, repo TransactionRepo) (*CheckoutResponse, error) {\n    if err := req.Validate(); err != nil {\n        return nil, err\n    }\n\n    total := CalculateTotal(req.Items)\n    tx, err := repo.CreatePending(ctx, req.UserID, total)\n    if err != nil {\n        return nil, err\n    }\n\n    payment, err := payments.Charge(ctx, ChargeRequest{Amount: total, Card: req.Card})\n    if err != nil {\n        _ = repo.MarkFailed(ctx, tx.ID, err.Error())\n        return nil, err\n    }\n\n    if err := repo.MarkSuccess(ctx, tx.ID, payment.ID); err != nil {\n        return nil, err\n    }\n\n    return &CheckoutResponse{OK: true, Total: total, TransactionID: tx.ID}, nil\n}`;
  }

  return `type CheckoutRequest = {\n  userId: string;\n  items: Array<{ price: number; qty: number }>;\n  card: PaymentCard;\n};\n\nexport async function checkout(req: Request, res: Response) {\n  const payload = validateCheckoutRequest(req.body);\n  const total = calculateTotal(payload.items);\n\n  try {\n    const transaction = await transactionRepository.createPending({\n      userId: payload.userId,\n      amount: total,\n    });\n\n    const payment = await paymentClient.charge({\n      amount: total,\n      card: payload.card,\n      userId: payload.userId,\n    });\n\n    await transactionRepository.markSuccess(transaction.id, payment.id);\n    return res.json({ ok: true, total, transactionId: transaction.id });\n  } catch (error) {\n    logger.error(\"checkout_failed\", { userId: payload.userId, error });\n    return res.status(502).json({ ok: false, error: \"payment failed\" });\n  }\n}`;
}

function teamDiagnosis(mode: string, charges: Charge[], score: number) {
  if (score >= 82) {
    return "The team has taste. The court recommends tests, not therapy.";
  }

  if (/Investor/.test(mode)) {
    return "The team understands the market, but the code needs operating discipline before it can scale without heroics.";
  }

  if (/Security/.test(mode)) {
    return "The team ships quickly, but secrets, injection risks, and error paths need a stricter review ritual.";
  }

  if (charges.some((charge) => charge.severity === "critical")) {
    return "This was written during a deadline, reviewed during a calendar conflict, and deployed with optimism.";
  }

  return "The team understands the problem, but the code does not yet understand itself.";
}

function verdictForScore(score: number, charges: Charge[]) {
  if (charges.some((charge) => charge.severity === "critical")) {
    return "GUILTY OF PRODUCTION NEGLIGENCE";
  }

  if (score >= 88) return "ACQUITTED, BUT ON THIN ICE";
  if (score >= 72) return "SHIP IT, BUT DO NOT SLEEP";
  if (score >= 52) return "REFACTOR BEFORE THIS REACHES CUSTOMERS";
  return "THIS CODE NEEDS ADULT SUPERVISION";
}

export function normalizeRoastResult(input: Partial<RoastResult>): RoastResult {
  const charges = Array.isArray(input.charges) ? input.charges : [];
  const safeCharges = charges.slice(0, 8).map((charge) => ({
    title: capText(charge.title, 120) || "Suspicious code behavior",
    severity: ["low", "medium", "high", "critical"].includes(charge.severity) ? charge.severity : "medium",
    explanation: capText(charge.explanation, 500) || "The code has a risk that needs review.",
    evidence: charge.evidence ? capText(charge.evidence, 280) : undefined,
    fix: capText(charge.fix, 500) || "Isolate the responsibility and add tests.",
  }));

  return {
    verdict: capText(input.verdict, 120) || "REFACTOR BEFORE THIS REACHES CUSTOMERS",
    overallScore: clamp(Number(input.overallScore ?? 50)),
    maintainability: clamp(Number(input.maintainability ?? 50)),
    security: clamp(Number(input.security ?? 50)),
    readability: clamp(Number(input.readability ?? 50)),
    testability: clamp(Number(input.testability ?? 50)),
    productionReadiness: clamp(Number(input.productionReadiness ?? 50)),
    roast: Array.isArray(input.roast) ? input.roast.slice(0, 7).map((item) => capText(item, 360)) : [],
    charges: safeCharges,
    evidence: Array.isArray(input.evidence) ? input.evidence.slice(0, 8).map((item) => capText(item, 320)) : [],
    refactorPlan: Array.isArray(input.refactorPlan) ? input.refactorPlan.slice(0, 7).map((item) => capText(item, 360)) : [],
    cleanerVersion: capText(input.cleanerVersion, 4000) || buildCleanerVersion("TypeScript"),
    teamDiagnosis: capText(input.teamDiagnosis, 500) || "The team has momentum, but the code needs clearer ownership.",
    finalVerdict: capText(input.finalVerdict, 160) || capText(input.verdict, 160) || "REFACTOR BEFORE THIS REACHES CUSTOMERS",
    fallbackUsed: Boolean(input.fallbackUsed),
  };
}

export function buildRoastSchema() {
  const score = { type: "number", minimum: 0, maximum: 100 };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "verdict",
      "overallScore",
      "maintainability",
      "security",
      "readability",
      "testability",
      "productionReadiness",
      "roast",
      "charges",
      "evidence",
      "refactorPlan",
      "cleanerVersion",
      "teamDiagnosis",
      "finalVerdict",
    ],
    properties: {
      verdict: { type: "string" },
      overallScore: score,
      maintainability: score,
      security: score,
      readability: score,
      testability: score,
      productionReadiness: score,
      roast: { type: "array", minItems: 2, maxItems: 7, items: { type: "string" } },
      charges: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "severity", "explanation", "evidence", "fix"],
          properties: {
            title: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            explanation: { type: "string" },
            evidence: { type: "string" },
            fix: { type: "string" },
          },
        },
      },
      evidence: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
      refactorPlan: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } },
      cleanerVersion: { type: "string" },
      teamDiagnosis: { type: "string" },
      finalVerdict: { type: "string" },
    },
  };
}
