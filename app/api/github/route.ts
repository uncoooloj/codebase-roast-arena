import { NextResponse } from "next/server";

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".php"];
const MAX_FILE_CHARS = 7000;
const MAX_TOTAL_CHARS = 28000;

type GitHubRequest = {
  url?: string;
};

function parseGitHubUrl(value: string) {
  const url = new URL(value);

  if (url.hostname === "raw.githubusercontent.com") {
    const [owner, repo, branch, ...pathParts] = url.pathname.split("/").filter(Boolean);
    return { kind: "raw" as const, owner, repo, branch, path: pathParts.join("/") };
  }

  if (!["github.com", "www.github.com"].includes(url.hostname)) {
    throw new Error("Use a github.com or raw.githubusercontent.com URL.");
  }

  const [owner, repo, marker, branch, ...pathParts] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo) throw new Error("GitHub URL must include owner and repo.");

  if (marker === "blob" && branch && pathParts.length) {
    return { kind: "blob" as const, owner, repo, branch, path: pathParts.join("/") };
  }

  if (marker === "tree" && branch) {
    return { kind: "repo" as const, owner, repo, branch, path: pathParts.join("/") };
  }

  return { kind: "repo" as const, owner, repo, branch: "", path: "" };
}

function languageFromPath(path: string) {
  if (path.endsWith(".py")) return "Python";
  if (path.endsWith(".go")) return "Go";
  if (path.endsWith(".php")) return "PHP";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "JavaScript";
  return "TypeScript";
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function defaultBranch(owner: string, repo: string) {
  const data = JSON.parse(await fetchText(`https://api.github.com/repos/${owner}/${repo}`)) as { default_branch?: string };
  return data.default_branch || "main";
}

async function loadBlob(owner: string, repo: string, branch: string, path: string) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  return {
    code: `// ${owner}/${repo}/${path}\n\n${await fetchText(rawUrl)}`,
    language: languageFromPath(path),
  };
}

async function loadRepo(owner: string, repo: string, branch: string, basePath: string) {
  const resolvedBranch = branch || (await defaultBranch(owner, repo));
  const tree = JSON.parse(
    await fetchText(`https://api.github.com/repos/${owner}/${repo}/git/trees/${resolvedBranch}?recursive=1`),
  ) as { tree?: Array<{ path: string; type: string; size?: number }> };

  const files = (tree.tree ?? [])
    .filter((file) => file.type === "blob")
    .filter((file) => (!basePath ? true : file.path.startsWith(`${basePath}/`) || file.path === basePath))
    .filter((file) => EXTENSIONS.some((ext) => file.path.endsWith(ext)))
    .filter((file) => (file.size ?? 0) <= 70000)
    .slice(0, 6);

  if (!files.length) throw new Error("No supported code files found in that public GitHub URL.");

  let total = "";
  let language = "TypeScript";

  for (const file of files) {
    if (!total) language = languageFromPath(file.path);
    const raw = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${resolvedBranch}/${file.path}`);
    total += `// ${owner}/${repo}/${file.path}\n${raw.slice(0, MAX_FILE_CHARS)}\n\n`;
    if (total.length >= MAX_TOTAL_CHARS) break;
  }

  return { code: total.slice(0, MAX_TOTAL_CHARS), language };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GitHubRequest;
    if (!body.url?.trim()) throw new Error("Paste a public GitHub URL first.");

    const parsed = parseGitHubUrl(body.url.trim());
    const result =
      parsed.kind === "repo"
        ? await loadRepo(parsed.owner, parsed.repo, parsed.branch, parsed.path)
        : await loadBlob(parsed.owner, parsed.repo, parsed.branch, parsed.path);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load that GitHub URL." },
      { status: 400 },
    );
  }
}
