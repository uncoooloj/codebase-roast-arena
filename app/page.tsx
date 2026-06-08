"use client";

import { useMemo, useState } from "react";
import { languages, roastModes, type Charge, type RoastResult } from "../lib/analysis";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const cursedCheckout = `export async function checkout(req: any, res: any) {
  const apiKey = "DEMO_LIVE_PAYMENT_KEY_SUPER_SECRET";
  console.log("checkout started", req.body);

  try {
    if (req.body) {
      if (req.body.userId) {
        if (req.body.items && req.body.items.length > 0) {
          if (req.body.card) {
            let total = 0;

            for (let i = 0; i < req.body.items.length; i++) {
              total += req.body.items[i].price * req.body.items[i].qty;
            }

            if (total > 10000) {
              console.log("large order");
            }

            const sql =
              "INSERT INTO transactions(user_id, amount, status) VALUES('" +
              req.body.userId +
              "', '" +
              total +
              "', 'pending')";

            await db.query(sql);

            const payment = await fetch("https://payment.example.com/charge", {
              method: "POST",
              headers: {
                Authorization: "Bearer " + apiKey,
              },
              body: JSON.stringify({
                amount: total,
                card: req.body.card,
                user: req.body.userId,
              }),
            });

            const result = await payment.json();

            if (result.success) {
              await db.query(
                "UPDATE transactions SET status='success' WHERE user_id='" +
                  req.body.userId +
                  "'"
              );

              res.json({ ok: true, message: "paid", total });
            } else {
              res.status(400).json({ ok: false, error: "payment failed" });
            }
          } else {
            res.status(400).json({ error: "no card" });
          }
        } else {
          res.status(400).json({ error: "no items" });
        }
      } else {
        res.status(400).json({ error: "no user" });
      }
    } else {
      res.status(400).json({ error: "no body" });
    }
  } catch (e) {
    // TODO: fix this later
  }
}`;

const suspiciousAuth = `export async function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  console.log("auth token", token);

  if (token) {
    const user = await db.query("SELECT * FROM users WHERE token = '" + token + "'");
    if (user && user.rows && user.rows.length > 0) {
      if (user.rows[0].is_active) {
        if (user.rows[0].role === "admin" || req.query.debug === "true") {
          req.user = user.rows[0];
          next();
        } else {
          res.status(403).json({ error: "forbidden" });
        }
      } else {
        res.status(401).json({ error: "inactive" });
      }
    } else {
      res.status(401).json({ error: "bad token" });
    }
  } else {
    res.status(401).json({ error: "missing token" });
  }
}`;

const cleanSample = `type CheckoutItem = {
  price: number;
  quantity: number;
};

type CheckoutRequest = {
  userId: string;
  items: CheckoutItem[];
  paymentMethodId: string;
};

export async function createCheckoutSession(input: CheckoutRequest) {
  const validation = validateCheckout(input);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const total = calculateTotal(input.items);
  const transaction = await transactions.createPending({
    userId: input.userId,
    total,
  });

  try {
    const payment = await payments.charge({
      amount: total,
      paymentMethodId: input.paymentMethodId,
    });

    await transactions.markPaid(transaction.id, payment.id);
    return { ok: true, transactionId: transaction.id, total };
  } catch (error) {
    await transactions.markFailed(transaction.id);
    logger.error("checkout_failed", { transactionId: transaction.id, error });
    return { ok: false, error: "Unable to process payment" };
  }
}`;

const scanSteps = [
  "Initializing courtroom...",
  "Summoning senior engineers...",
  "Inspecting the crime scene...",
  "Cross-examining abstractions...",
  "Checking for secrets...",
  "Measuring production blast radius...",
  "Preparing verdict...",
];

const generatedFiles = [
  "roast-report.md",
  "charges.json",
  "refactor-plan.md",
  "cleaned-version.ts",
  "incident-risk.md",
];

const tabs = [
  "The Roast",
  "Charges",
  "Evidence",
  "Refactor Plan",
  "Cleaner Version",
  "Team Diagnosis",
  "Final Verdict",
] as const;

type Tab = (typeof tabs)[number];
type Motion = "objection" | "appeal" | "redemption";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tone(soundOn: boolean, frequency: number, duration = 0.12, type: OscillatorType = "square") {
  if (!soundOn || typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.075, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.03);
}

function playStartSound(soundOn: boolean) {
  tone(soundOn, 164, 0.13, "sawtooth");
  window.setTimeout(() => tone(soundOn, 246, 0.13, "square"), 95);
}

function playScanTick(soundOn: boolean) {
  tone(soundOn, 720 + Math.random() * 90, 0.045, "square");
}

function playWarningSound(soundOn: boolean) {
  tone(soundOn, 180, 0.16, "sawtooth");
  window.setTimeout(() => tone(soundOn, 150, 0.12, "sawtooth"), 120);
}

function playVerdictSound(soundOn: boolean, score: number) {
  tone(soundOn, score > 70 ? 392 : 220, 0.18, "triangle");
  window.setTimeout(() => tone(soundOn, score > 70 ? 523 : 146, 0.22, "sawtooth"), 170);
}

function severityClass(severity: Charge["severity"]) {
  return `severity severity-${severity}`;
}

function metricLabel(value: number) {
  if (value >= 82) return "stable";
  if (value >= 65) return "heated";
  if (value >= 45) return "risky";
  return "critical";
}

export default function Home() {
  const [code, setCode] = useState(cursedCheckout);
  const [language, setLanguage] = useState("TypeScript");
  const [mode, setMode] = useState("Brutal Staff Engineer");
  const [soundOn, setSoundOn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [motionLoading, setMotionLoading] = useState<Motion | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<RoastResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("The Roast");
  const [error, setError] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);

  const severityCounts = useMemo(() => {
    const counts: Record<Charge["severity"], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const charge of result?.charges ?? []) {
      counts[charge.severity] += 1;
    }

    return counts;
  }, [result]);

  async function runScan() {
    setLogs([]);

    for (let index = 0; index < scanSteps.length; index += 1) {
      setActiveStep(index);
      setProgress(Math.round(((index + 1) / scanSteps.length) * 88));
      setLogs((current) => [
        ...current.slice(-7),
        `[${String(index + 1).padStart(2, "0")}] ${scanSteps[index]}`,
      ]);
      playScanTick(soundOn);
      await sleep(340);
    }
  }

  async function loadGithubUrl() {
    if (!githubUrl.trim()) {
      setError("Paste a public GitHub repo, folder, blob, or raw URL first.");
      return;
    }

    setError("");
    setIsFetchingGithub(true);

    try {
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load that GitHub URL.");
      setCode(data.code);
      setLanguage(data.language || "TypeScript");
      setLogs([`[GH] Imported public GitHub evidence from ${githubUrl}`]);
      setProgress(0);
      setResult(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "GitHub import failed.");
    } finally {
      setIsFetchingGithub(false);
    }
  }

  async function requestRoast(motion?: Motion) {
    setError("");

    const body = {
      code,
      language,
      mode,
      motion,
      focusCharge: result?.charges[0]?.title,
    };

    const response = await fetch("/api/roast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The court clerk dropped the file.");
    }

    return data as RoastResult;
  }

  async function beginTrial() {
    if (!code.trim()) {
      setError("Paste code before beginning the trial.");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setResult(null);
    setActiveTab("The Roast");
    playStartSound(soundOn);

    try {
      const roastPromise = requestRoast();
      await runScan();
      setProgress(92);
      setLogs((current) => [...current.slice(-7), "[08] Awaiting judge response..."]);
      const verdict = await roastPromise;
      setResult(verdict);
      setProgress(100);
      playVerdictSound(soundOn, verdict.overallScore);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The trial collapsed unexpectedly.");
      playWarningSound(soundOn);
    } finally {
      setIsLoading(false);
    }
  }

  async function fileMotion(motion: Motion) {
    if (!result) return;
    setMotionLoading(motion);
    playWarningSound(soundOn);

    try {
      const verdict = await requestRoast(motion);
      setResult(verdict);
      setActiveTab(motion === "redemption" ? "Refactor Plan" : "The Roast");
      playVerdictSound(soundOn, verdict.overallScore);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The motion was overruled by the network.");
    } finally {
      setMotionLoading(null);
    }
  }

  return (
    <main className="arena">
      <div className="grid-glow" />
      <header className="topbar arcade-window">
        <div className="browser-strip">
          <div className="window-mark">CRA</div>
          <h1>Codebase Roast Arena</h1>
          <nav aria-label="Arcade menu">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Trial</span>
            <span>Help</span>
          </nav>
          <div className="url-slot">http://localhost:3001/arena</div>
          <div className="window-buttons" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="marquee-row">
          <div className="case-file">
            <span>Case:</span>
            <strong>{language.toLowerCase()}_logic.{language === "Python" ? "py" : language === "Go" ? "go" : language === "PHP" ? "php" : "ts"}</strong>
          </div>
          <div className="maze-chase" aria-hidden="true">
            <span className="pacman" />
            <span className="pellets" />
            <span className="ghost ghost-pink" />
            <span className="trial-marquee">{isLoading ? "Trial in progress" : result ? "Verdict logged" : "Insert code to start"}</span>
            <span className="ghost ghost-cyan" />
            <span className="pellets" />
          </div>
          <div className="top-actions">
            <span className={result?.fallbackUsed ? "api-pill fallback" : "api-pill"}>
              {result ? (result.fallbackUsed ? "Local judge" : "OpenAI judge") : "Court idle"}
            </span>
            <button className="ghost-button" type="button" onClick={() => setSoundOn((current) => !current)}>
              Sound {soundOn ? "On" : "Off"}
            </button>
          </div>
        </div>
      </header>

      <section className="trial-layout">
        <aside className="panel editor-panel">
          <div className="panel-header">
            <div>
              <span className="panel-label">Evidence intake</span>
              <h2>Start with a GitHub URL</h2>
              <p className="panel-subcopy">Load a public repo, folder, or file. Manual paste is the fallback.</p>
            </div>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language">
              {languages.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="github-intake primary-intake">
            <div className="github-prompt">
              <strong>GitHub case file</strong>
              <span>Repo, tree, blob, or raw URL</span>
            </div>
            <input
              value={githubUrl}
              onChange={(event) => setGithubUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              aria-label="GitHub URL"
            />
            <button type="button" onClick={loadGithubUrl} disabled={isFetchingGithub}>
              {isFetchingGithub ? "Loading..." : "Load GitHub"}
            </button>
          </div>

          <div className="manual-divider">
            <span>or paste code manually</span>
          </div>

          <textarea
            className="code-editor"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            aria-label="Code input"
          />

          <div className="sample-row">
            <button type="button" onClick={() => setCode(cursedCheckout)}>
              Load Cursed Checkout Handler
            </button>
            <button type="button" onClick={() => setCode(suspiciousAuth)}>
              Load Suspicious Auth Middleware
            </button>
            <button type="button" onClick={() => setCode(cleanSample)}>
              Load Clean Sample
            </button>
          </div>
        </aside>

        <section className="panel command-panel">
          <div className="versus-lockup">
            <span>THE PEOPLE</span>
            <strong>VS</strong>
            <span>THE CODEBASE</span>
          </div>

          <div className="mode-grid" aria-label="Roast mode selector">
            {roastModes.map((item) => (
              <button
                className={item === mode ? "mode-button active" : "mode-button"}
                key={item}
                type="button"
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button className="trial-button" type="button" onClick={beginTrial} disabled={isLoading}>
            {isLoading ? "Trial in progress" : "Insert Coin / Begin Trial"}
          </button>

          {error ? <div className="error-banner">{error}</div> : null}

          <div className="scan-box">
            <div className="scan-header">
              <span>{isLoading ? scanSteps[activeStep] : "Courtroom telemetry"}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="terminal">
              {(logs.length ? logs : ["[00] Waiting for the accused code to take the stand."]).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="evidence-tags">
              <span>secrets</span>
              <span>nesting</span>
              <span>blast radius</span>
              <span>testability</span>
            </div>
          </div>

          <div className="generated-panel">
            <div className="panel-label">Generated files</div>
            {generatedFiles.map((file, index) => (
              <div className="file-row" key={file}>
                <span>{file}</span>
                <strong>{result || isLoading ? "generated" : index === 0 ? "queued" : "pending"}</strong>
              </div>
            ))}
            <div className="coin-counter">
              <span>Roast coins</span>
              <strong>{result ? String(Math.max(0, 100 - result.overallScore) * 320).padStart(6, "0") : "000000"}</strong>
            </div>
          </div>
        </section>

        <section className="panel verdict-panel">
          {result ? (
            <>
              <div className="verdict-banner">
                <span><i className="mini-pac" /> Verdict board</span>
                <strong>{result.finalVerdict}</strong>
              </div>

              <div className="health-card">
                <div className="score-orb">
                  <span>{result.overallScore}</span>
                  <small>survival score</small>
                </div>
                <div className="health-copy">
                  <h2>{result.verdict}</h2>
                  <p>
                    {result.fallbackUsed
                      ? "Deterministic fallback handled this trial. Add OPENAI_API_KEY for live AI testimony."
                      : "OpenAI delivered live testimony. The local fallback remains ready if the network panics."}
                  </p>
                  <div className="health-track">
                    <span style={{ width: `${result.overallScore}%` }} />
                  </div>
                </div>
              </div>

              <div className="metric-grid">
                {[
                  ["Maintainability", result.maintainability],
                  ["Security", result.security],
                  ["Readability", result.readability],
                  ["Testability", result.testability],
                  ["Production", result.productionReadiness],
                ].map(([label, value]) => (
                  <div className="metric-card" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{metricLabel(Number(value))}</small>
                  </div>
                ))}
              </div>

              <div className="severity-row">
                {(["critical", "high", "medium", "low"] as const).map((severity) => (
                  <span className={severityClass(severity)} key={severity}>
                    {severity}: {severityCounts[severity]}
                  </span>
                ))}
              </div>

              <div className="tab-row">
                {tabs.map((tab) => (
                  <button className={activeTab === tab ? "tab active" : "tab"} key={tab} type="button" onClick={() => setActiveTab(tab)}>
                    {tab}
                  </button>
                ))}
              </div>

              <ResultTab result={result} activeTab={activeTab} />

              <div className="motion-row">
                <button type="button" onClick={() => fileMotion("objection")} disabled={Boolean(motionLoading)}>
                  {motionLoading === "objection" ? "Arguing..." : "Objection!"}
                </button>
                <button type="button" onClick={() => fileMotion("appeal")} disabled={Boolean(motionLoading)}>
                  {motionLoading === "appeal" ? "Appealing..." : "Appeal Verdict"}
                </button>
                <button type="button" onClick={() => fileMotion("redemption")} disabled={Boolean(motionLoading)}>
                  {motionLoading === "redemption" ? "Drafting..." : "Generate Redemption Arc"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-verdict">
              <div className="empty-orb">VS</div>
              <h2>The bench is waiting.</h2>
              <p>Load a cursed sample, choose a roast mode, and begin the trial.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function ResultTab({ result, activeTab }: { result: RoastResult; activeTab: Tab }) {
  if (activeTab === "The Roast") {
    return (
      <div className="tab-content roast-list">
        {result.roast.map((item, index) => (
          <article key={item}>
            <span>Exhibit R-{index + 1}</span>
            <p>{item}</p>
          </article>
        ))}
      </div>
    );
  }

  if (activeTab === "Charges") {
    return (
      <div className="tab-content charge-grid">
        {result.charges.map((charge) => (
          <article className="charge-card" key={charge.title}>
            <div>
              <h3>{charge.title}</h3>
              <span className={severityClass(charge.severity)}>{charge.severity}</span>
            </div>
            <p>{charge.explanation}</p>
            {charge.evidence ? <small>Evidence: {charge.evidence}</small> : null}
            <strong>Fix: {charge.fix}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (activeTab === "Evidence") {
    return (
      <div className="tab-content evidence-list">
        {result.evidence.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    );
  }

  if (activeTab === "Refactor Plan") {
    return (
      <ol className="tab-content plan-list">
        {result.refactorPlan.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  if (activeTab === "Cleaner Version") {
    return (
      <pre className="tab-content cleaner-code">
        <code>{result.cleanerVersion}</code>
      </pre>
    );
  }

  if (activeTab === "Team Diagnosis") {
    return (
      <div className="tab-content diagnosis">
        <p>{result.teamDiagnosis}</p>
      </div>
    );
  }

  return (
    <div className="tab-content final-card">
      <h3>{result.finalVerdict}</h3>
      <p>This is not just linting. This is what happens when static analysis gets a personality and becomes readable to the whole team.</p>
    </div>
  );
}
