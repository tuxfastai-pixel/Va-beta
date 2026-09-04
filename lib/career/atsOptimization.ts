export function optimizeForAts(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/[\t\r]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => (line.length > 140 ? `${line.slice(0, 137)}...` : line))
}
