export function createUnifiedDiff(
  filePath: string,
  original: string,
  updated: string
): string {
  if (original === updated) return "";
  const oldLines = original.split("\n");
  const newLines = updated.split("\n");

  const header = `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,${oldLines.length} +1,${newLines.length} @@`;
  const maxLen = Math.max(oldLines.length, newLines.length);
  const body: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (o !== undefined) body.push(` ${o}`);
    } else {
      if (o !== undefined) body.push(`-${o}`);
      if (n !== undefined) body.push(`+${n}`);
    }
  }

  return `${header}\n${body.join("\n")}`;
}
