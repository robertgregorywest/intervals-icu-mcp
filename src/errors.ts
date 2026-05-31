import { HttpError } from "./client.js";

export function formatToolError(error: Error): string {
  if (error instanceof HttpError) {
    switch (error.status) {
      case 401:
      case 403:
        return (
          `Authentication failed (HTTP ${error.status}): ${error.message}. ` +
          "Check that INTERVALS_API_KEY is set correctly."
        );
      case 404:
        return (
          `Not found (HTTP 404): ${error.message}. ` +
          "Verify the resource ID exists and belongs to this athlete."
        );
      case 422:
        return (
          `Invalid request (HTTP 422): ${error.message}. ` +
          "Check parameter formats and required fields."
        );
      case 429:
        return (
          `Rate limited (HTTP 429): ${error.message}. ` +
          "Wait a moment before retrying."
        );
      default:
        if (error.status >= 500) {
          return (
            `Intervals.icu temporarily unavailable (HTTP ${error.status}): ${error.message}. ` +
            "Retry shortly."
          );
        }
        return `HTTP ${error.status}: ${error.message}`;
    }
  }
  if (error.name === "ZodError") {
    return `Validation error: ${error.message}`;
  }
  return error.message || String(error);
}
