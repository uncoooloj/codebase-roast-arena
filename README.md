# Codebase Roast Arena

A cyberpunk courtroom where your code gets cross-examined.

Codebase Roast Arena is a Next.js + TypeScript hackathon app that turns code review into a neon trial. Paste a snippet, pick the tone, and let the arena produce a brutal-but-useful roast, charges, evidence, risk scores, a refactor plan, a cleaner version, and a final verdict.

The app uses `OPENAI_API_KEY` when available and falls back to deterministic local analysis when it is not. That means the demo still works in public, offline-ish, CI, or judge-table chaos.

## Features

- Cyberpunk courtroom code review flow
- OpenAI-powered roasts with deterministic fallback
- One environment variable: `OPENAI_API_KEY`
- Web Audio sound effects with a sound toggle
- TypeScript-first Next.js App Router app
- No database, auth, or external media assets
- Sample snippets for cursed checkout, suspicious auth, and clean code

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your key to `.env.local`:

```txt
OPENAI_API_KEY=<your_openai_api_key>
```

Then open:

```txt
http://localhost:3000
```

## Demo Without A Key

If `OPENAI_API_KEY` is missing, the app uses deterministic fallback responses. This keeps the courtroom flow, UI, generated files panel, code smells, scores, and sound design demoable without live API access.

## Demo Script

1. Open the app.
2. Click **Load Cursed Checkout Handler**.
3. Pick a roast mode, such as **Production Incident Commander**.
4. Click **Begin Trial**.
5. Show the scan sequence, fake generated files, verdict banner, score bars, charges, and cleaner version.
6. Click **Objection!**, **Appeal Verdict**, or **Generate Redemption Arc**.
7. Close with: "This is not just linting. This is what happens when static analysis gets a personality and becomes readable to the whole team."

## Environment

```txt
OPENAI_API_KEY=
```

No other environment variables are required.

## Public Repo Checklist

- `.env.example` includes only `OPENAI_API_KEY=`
- `.env.local` and other secret-bearing env files are ignored
- Fallback works without a key
- `npm run typecheck` passes
- `npm run build` passes
- Web Audio is behind user interaction and has a toggle
- Mobile layout remains usable for judges browsing on phones

## License

MIT
