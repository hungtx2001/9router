import { DefaultExecutor } from "./default.js";
import { resolveAzureConfig } from "./azureConfig.js";

export { resolveAzureConfig };

export class AzureExecutor extends DefaultExecutor {
  constructor() {
    super("azure");
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    return resolveAzureConfig(credentials, model).url;
  }

  buildHeaders(credentials, stream = true) {
    const headers = {
      "Content-Type": "application/json",
      ...this.config.headers
    };

    const apiKey = credentials?.apiKey
      || credentials?.accessToken
      || process.env.OPENAI_API_KEY;

    const { authScheme } = resolveAzureConfig(credentials);

    if (apiKey) {
      if (authScheme === "bearer") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
        headers["api-key"] = apiKey;
      }
    }

    const organization = credentials?.providerSpecificData?.organization
      || process.env.AZURE_ORGANIZATION;

    if (organization) {
      headers["OpenAI-Organization"] = organization;
    }

    if (stream) {
      headers["Accept"] = "text/event-stream";
    }

    return headers;
  }

  transformRequest(model, body, stream, credentials) {
    if (!body || typeof body !== "object") return body;
    const out = !body.model && model ? { ...body, model } : { ...body };
    const { endpointMode } = resolveAzureConfig(credentials, model);

    if (endpointMode === "responses") {
      if (out.reasoning_effort !== undefined) {
        if (out.reasoning_effort !== "none" && out.reasoning === undefined) {
          out.reasoning = { effort: out.reasoning_effort, summary: "auto" };
        }
        delete out.reasoning_effort;
      }
    } else if (
      Array.isArray(out.tools) &&
      out.tools.length > 0 &&
      out.reasoning_effort &&
      out.reasoning_effort !== "none" &&
      /gpt-6-luna/i.test(out.model || model || "")
    ) {
      // Azure /chat/completions rejects function tools + reasoning_effort on gpt-6-luna
      out.reasoning_effort = "none";
    }

    return out;
  }
}
