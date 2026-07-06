import { describe, it, expect, vi } from "vitest";
import {
  registerSetupCoachingPrompt,
  SETUP_COACHING_PROMPT,
} from "../../../src/mcp/prompts/setup-coaching.js";

describe("registerSetupCoachingPrompt", () => {
  it("registers a prompt named setup_coaching whose callback returns the interview text", () => {
    const registerPrompt = vi.fn();
    const fakeServer = { registerPrompt } as unknown as Parameters<
      typeof registerSetupCoachingPrompt
    >[0];

    registerSetupCoachingPrompt(fakeServer);

    expect(registerPrompt).toHaveBeenCalledTimes(1);
    const [name, config, cb] = registerPrompt.mock.calls[0];
    expect(name).toBe("setup_coaching");
    expect(config.title).toBe("Set up coaching context");
    expect(config.description).toMatch(/interview/i);

    const result = cb();
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content.text).toBe(SETUP_COACHING_PROMPT);
  });

  it("interview text bootstraps personal season + steering files and points at the philosophy skill", () => {
    expect(SETUP_COACHING_PROMPT).toContain("season.md");
    expect(SETUP_COACHING_PROMPT).toContain("steering.md");
    expect(SETUP_COACHING_PROMPT).toContain("coaching-philosophy");
    expect(SETUP_COACHING_PROMPT).toContain("docs/personal/");
    expect(SETUP_COACHING_PROMPT).toContain("get_coaching_context");
    expect(SETUP_COACHING_PROMPT).toContain("intervals-coach");
    // The Claude-Project-knowledge upload path is retired.
    expect(SETUP_COACHING_PROMPT).not.toMatch(/Project knowledge/i);
    expect(SETUP_COACHING_PROMPT).not.toContain("INTERVALS_COACHING_DIR");
    expect(SETUP_COACHING_PROMPT).not.toContain("athlete.md");
    expect(SETUP_COACHING_PROMPT).not.toMatch(
      /restart\s+(claude|the\s+(host|server))/i
    );
  });
});
