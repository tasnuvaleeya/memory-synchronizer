import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { isTextExtension } from "./languageMap.js";

export interface FileMetrics {
  sha: string;
  lineCount: number;
  isText: boolean;
}

/**
 * Stream-read a file, compute sha256 and newline count in one pass.
 * Binary (non-text-extension) files return `lineCount: 0` and `isText: false`.
 *
 * Line count semantics: count of `\n` bytes. A file with a single line and no
 * trailing newline therefore returns 0, which matches `wc -l` exactly.
 * Adjust callers if a "human line count" (max of newline+1, 0 for empty) is
 * needed later; for the shape report we mirror `wc -l` for predictability.
 */
export async function measureFile(absPath: string): Promise<FileMetrics> {
  const treatAsText = isTextExtension(absPath);

  return new Promise<FileMetrics>((resolve, reject) => {
    const hash = createHash("sha256");
    let lineCount = 0;
    const stream = createReadStream(absPath);

    stream.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      hash.update(buf);
      if (treatAsText) {
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] === 0x0a) lineCount += 1;
        }
      }
    });
    stream.on("end", () => {
      resolve({
        sha: hash.digest("hex"),
        lineCount: treatAsText ? lineCount : 0,
        isText: treatAsText,
      });
    });
    stream.on("error", reject);
  });
}
