import { describe, expect, it } from "vitest";
import { AzureExecutor, resolveAzureConfig } from "open-sse/executors/azure.js";
import { getTargetFormat } from "open-sse/services/provider.js";

describe("Azure OpenAI chat completions transport", () => {
  const executor = new AzureExecutor();

  it("always targets deployment chat/completions, including legacy Responses URLs", () => {
    const legacy = { providerSpecificData: { azureEndpoint: "https://resource.openai.azure.com/openai/responses?api-version=2025-04-01-preview", endpointMode: "responses", deployment: "gpt-6" } };
    expect(resolveAzureConfig(legacy).url).toBe("https://resource.openai.azure.com/openai/deployments/gpt-6/chat/completions?api-version=2025-04-01-preview");
    expect(getTargetFormat("azure", legacy)).toBe("openai");
  });

  it("uses Azure api-key auth and preserves chat payloads", () => {
    const credentials = { apiKey: "secret", providerSpecificData: { azureEndpoint: "https://resource.openai.azure.com", deployment: "my-deployment" } };
    expect(executor.buildUrl("gpt-6", false, 0, credentials)).toBe("https://resource.openai.azure.com/openai/deployments/my-deployment/chat/completions?api-version=2024-10-01-preview");
    expect(executor.buildHeaders(credentials, false)).toMatchObject({ "api-key": "secret", "Content-Type": "application/json" });
    const body = { messages: [{ role: "user", content: "hi" }], reasoning_effort: "high" };
    expect(executor.transformRequest("gpt-6", body, false, credentials)).toEqual({ ...body, model: "gpt-6" });
  });
});
