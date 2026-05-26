import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "cli/index": "src/cli/index.ts",
    index: "src/index.ts",
  },
  format: ["esm", "cjs"],
  target: "node20",
  platform: "node",
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  outExtension({ format }) {
    return { js: format === "esm" ? ".js" : ".cjs" };
  },
  async onSuccess() {
    const { chmod } = await import("node:fs/promises");
    await chmod("dist/cli/index.js", 0o755).catch(() => undefined);
    await chmod("dist/cli/index.cjs", 0o755).catch(() => undefined);
  },
});
