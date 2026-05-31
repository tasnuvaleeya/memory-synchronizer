import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { globby } from "globby";
import { compareStrings } from "../core/paths.js";
import type { Stack } from "./types.js";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

const JS_FRAMEWORKS: Record<string, string> = {
  next: "Next.js",
  react: "React",
  "react-native": "React Native",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  "@sveltejs/kit": "SvelteKit",
  astro: "Astro",
  remix: "Remix",
  "@remix-run/react": "Remix",
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  koa: "Koa",
  "@nestjs/core": "NestJS",
  "@trpc/server": "tRPC",
  vitest: "Vitest",
  jest: "Jest",
  mocha: "Mocha",
  playwright: "Playwright",
  cypress: "Cypress",
};

const PY_FRAMEWORKS: Record<string, string> = {
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  starlette: "Starlette",
  pyramid: "Pyramid",
  pytest: "pytest",
};

export async function detectStack(cwd: string): Promise<Stack> {
  const stack: Stack = {
    languages: [],
    runtimes: [],
    packageManagers: [],
    frameworks: [],
    ci: [],
  };

  await detectJs(cwd, stack);
  await detectTypeScript(cwd, stack);
  await detectPython(cwd, stack);
  await detectRust(cwd, stack);
  await detectGo(cwd, stack);
  await detectDocker(cwd, stack);
  await detectCi(cwd, stack);

  // Deduplicate + sort each field for determinism
  for (const key of Object.keys(stack) as Array<keyof Stack>) {
    stack[key] = Array.from(new Set(stack[key])).sort(compareStrings);
  }

  return stack;
}

async function detectJs(cwd: string, stack: Stack): Promise<void> {
  const pkgPath = path.join(cwd, "package.json");
  if (!existsSync(pkgPath)) return;

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf8")) as PackageJson;
  } catch {
    return;
  }

  stack.languages.push("JavaScript");
  stack.runtimes.push("Node.js");

  // Package managers — lockfile presence is most reliable
  if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) stack.packageManagers.push("pnpm");
  if (existsSync(path.join(cwd, "yarn.lock"))) stack.packageManagers.push("yarn");
  if (existsSync(path.join(cwd, "package-lock.json"))) stack.packageManagers.push("npm");
  if (existsSync(path.join(cwd, "bun.lockb")) || existsSync(path.join(cwd, "bun.lock"))) {
    stack.packageManagers.push("bun");
    stack.runtimes.push("Bun");
  }
  // Fallback to package.json packageManager field
  if (stack.packageManagers.length === 0 && pkg.packageManager) {
    stack.packageManagers.push(pkg.packageManager.split("@")[0]!);
  }
  if (stack.packageManagers.length === 0) stack.packageManagers.push("npm");

  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const [dep, label] of Object.entries(JS_FRAMEWORKS)) {
    if (dep in allDeps) stack.frameworks.push(label);
  }
}

async function detectTypeScript(cwd: string, stack: Stack): Promise<void> {
  if (existsSync(path.join(cwd, "tsconfig.json"))) {
    stack.languages.push("TypeScript");
  }
}

async function detectPython(cwd: string, stack: Stack): Promise<void> {
  const pyproject = path.join(cwd, "pyproject.toml");
  const requirements = path.join(cwd, "requirements.txt");
  const setupPy = path.join(cwd, "setup.py");
  const setupCfg = path.join(cwd, "setup.cfg");

  let hasPython = false;
  let pyprojectContent = "";

  if (existsSync(pyproject)) {
    hasPython = true;
    try {
      pyprojectContent = await readFile(pyproject, "utf8");
    } catch {
      // ignore
    }
    if (pyprojectContent.includes("[tool.poetry]")) stack.packageManagers.push("poetry");
    if (pyprojectContent.includes("[tool.uv]") || pyprojectContent.includes("[tool.uv.")) {
      stack.packageManagers.push("uv");
    }
    if (pyprojectContent.includes("[tool.hatch]")) stack.packageManagers.push("hatch");
    if (pyprojectContent.includes("[tool.pdm]")) stack.packageManagers.push("pdm");
  }
  if (existsSync(requirements) || existsSync(setupPy) || existsSync(setupCfg)) {
    hasPython = true;
    if (stack.packageManagers.indexOf("pip") < 0) stack.packageManagers.push("pip");
  }

  if (hasPython) {
    stack.languages.push("Python");
    stack.runtimes.push("Python");

    const haystack = pyprojectContent.toLowerCase();
    for (const [dep, label] of Object.entries(PY_FRAMEWORKS)) {
      if (haystack.includes(dep)) stack.frameworks.push(label);
    }
  }
}

async function detectRust(cwd: string, stack: Stack): Promise<void> {
  if (existsSync(path.join(cwd, "Cargo.toml"))) {
    stack.languages.push("Rust");
    stack.runtimes.push("Rust");
    stack.packageManagers.push("cargo");
  }
}

async function detectGo(cwd: string, stack: Stack): Promise<void> {
  if (existsSync(path.join(cwd, "go.mod"))) {
    stack.languages.push("Go");
    stack.runtimes.push("Go");
    stack.packageManagers.push("go modules");
  }
}

async function detectDocker(cwd: string, stack: Stack): Promise<void> {
  const dockerfiles = await globby(["Dockerfile*", "**/Dockerfile*"], {
    cwd,
    dot: false,
    gitignore: true,
    ignore: ["node_modules/**", ".git/**"],
  });
  if (dockerfiles.length > 0) stack.frameworks.push("Docker");
  if (
    existsSync(path.join(cwd, "docker-compose.yml")) ||
    existsSync(path.join(cwd, "docker-compose.yaml"))
  ) {
    stack.frameworks.push("Docker Compose");
  }
}

async function detectCi(cwd: string, stack: Stack): Promise<void> {
  if (existsSync(path.join(cwd, ".github", "workflows"))) stack.ci.push("GitHub Actions");
  if (existsSync(path.join(cwd, ".gitlab-ci.yml"))) stack.ci.push("GitLab CI");
  if (existsSync(path.join(cwd, ".circleci", "config.yml"))) stack.ci.push("CircleCI");
  if (existsSync(path.join(cwd, "azure-pipelines.yml"))) stack.ci.push("Azure Pipelines");
  if (
    existsSync(path.join(cwd, ".travis.yml")) ||
    existsSync(path.join(cwd, "travis.yml"))
  ) {
    stack.ci.push("Travis CI");
  }
}
