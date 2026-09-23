export function maskPhone(normalized: string): string {
  const trimmed = normalized.trim();
  if (trimmed.length <= 4) return "****";
  return `***${trimmed.slice(-4)}`;
}
