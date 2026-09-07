/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("aiAssistant", () => {
  test("getAiConfig returns defaults when empty", async () => {
    const t = convexTest(schema, modules);
    const config = await t.query(api.aiAssistant.getAiConfig);
    expect(config.hasApiKey).toBe(false);
    expect(config.selectedModel).toBe("claude-3-5-sonnet-20241022");
  });

  test("saveAiConfig stores API key and selected model", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.aiAssistant.saveAiConfig, {
      apiKey: "sk-ant-api03-testkey123456789",
      selectedModel: "claude-3-5-haiku-20241022",
      systemPromptExtra: "Test extra prompt",
    });

    const config = await t.query(api.aiAssistant.getAiConfig);
    expect(config.hasApiKey).toBe(true);
    expect(config.selectedModel).toBe("claude-3-5-haiku-20241022");
    expect(config.systemPromptExtra).toBe("Test extra prompt");
    expect(config.apiKeyMasked).toBe("sk-ant-...6789");
  });
});
