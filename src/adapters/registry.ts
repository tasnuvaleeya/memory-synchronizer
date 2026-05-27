import type { Adapter } from "./base.js";

const BUILT_IN: Record<string, () => Promise<Adapter>> = {
  claude: () => import("./claude.js").then((m) => m.claudeAdapter),
  "agents-md": () => import("./agentsMd.js").then((m) => m.agentsMdAdapter),
  cursor: () => import("./cursor.js").then((m) => m.cursorAdapter),
  cline: () => import("./cline.js").then((m) => m.clineAdapter),
  windsurf: () => import("./windsurf.js").then((m) => m.windsurfAdapter),
  copilot: () => import("./copilot.js").then((m) => m.copilotAdapter),
};

const cache = new Map<string, Adapter>();

export function listBuiltInAdapters(): string[] {
  return Object.keys(BUILT_IN);
}

export async function loadAdapter(name: string): Promise<Adapter | null> {
  if (cache.has(name)) return cache.get(name)!;
  const loader = BUILT_IN[name];
  if (!loader) return null;
  const adapter = await loader();
  cache.set(name, adapter);
  return adapter;
}

export async function resolveAdapters(names: string[]): Promise<Adapter[]> {
  const result: Adapter[] = [];
  for (const name of names) {
    const adapter = await loadAdapter(name);
    if (adapter) result.push(adapter);
  }
  return result;
}
