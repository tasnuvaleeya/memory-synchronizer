/**
 * Static extension → language map. Phase-1 deliberately small: only widely-used
 * source languages. Users can override via `.agentctx/config.yaml`'s
 * `languageMap` field (extension → display name).
 */
const DEFAULT_MAP: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  pyi: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  swift: "Swift",
  c: "C",
  h: "C",
  cc: "C++",
  cpp: "C++",
  cxx: "C++",
  hpp: "C++",
  hxx: "C++",
  cs: "C#",
  rb: "Ruby",
  php: "PHP",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  md: "Markdown",
  mdx: "Markdown",
  yaml: "YAML",
  yml: "YAML",
  json: "JSON",
  toml: "TOML",
  xml: "XML",
  lua: "Lua",
  ex: "Elixir",
  exs: "Elixir",
  scala: "Scala",
  clj: "Clojure",
  hs: "Haskell",
  ml: "OCaml",
  zig: "Zig",
  vue: "Vue",
  svelte: "Svelte",
};

/** Lowercase extension without leading dot. Empty string when none. */
export function extensionOf(filePath: string): string {
  const idx = filePath.lastIndexOf(".");
  if (idx < 0 || idx === filePath.length - 1) return "";
  // Reject extensions that span a path separator (e.g. "foo.bar/baz")
  const dot = filePath.slice(idx);
  if (dot.includes("/") || dot.includes("\\")) return "";
  return filePath.slice(idx + 1).toLowerCase();
}

export function resolveLanguage(
  filePath: string,
  overrides: Record<string, string> = {},
): string | null {
  const ext = extensionOf(filePath);
  if (!ext) return null;
  const override = overrides[ext];
  if (override) return override;
  return DEFAULT_MAP[ext] ?? null;
}

/** Whether this extension is considered "text" — i.e. safe to line-count. */
export function isTextExtension(filePath: string): boolean {
  const ext = extensionOf(filePath);
  if (!ext) return false;
  if (ext in DEFAULT_MAP) return true;
  // Common config/doc files without language mappings
  return [
    "txt",
    "csv",
    "tsv",
    "log",
    "ini",
    "cfg",
    "conf",
    "env",
    "gitignore",
    "dockerignore",
    "editorconfig",
  ].includes(ext);
}
