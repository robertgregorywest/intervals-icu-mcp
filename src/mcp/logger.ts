export function logResponse(
  toolName: string,
  content: string,
  durationMs: number,
): void {
  const preview =
    content.length > 200 ? content.slice(0, 200) + "..." : content;
  console.error(
    `[intervals-icu-mcp] ${toolName} (${durationMs}ms): ${preview}`,
  );
}

export function logError(
  toolName: string,
  error: Error,
  durationMs: number,
): void {
  console.error(
    `[intervals-icu-mcp] ${toolName} FAILED (${durationMs}ms): ${error.message}`,
  );
}
