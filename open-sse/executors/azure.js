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

    const apiKey = credentials?.apiKey || process.env.OPENAI_API_KEY;

    if (apiKey) headers["api-key"] = apiKey;

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

  transformRequest(model, body) {
    if (!body || typeof body !== "object") return body;
    const out = !body.model && model ? { ...body, model } : { ...body };

    if (
      Array.isArray(out.tools) &&
      out.tools.length > 0 &&
      out.reasoning_effort &&
      out.reasoning_effort !== "none" &&
      /gpt-6-luna/i.test(out.model || model || "")
    ) {
      out.reasoning_effort = "none";
    }

    return out;
  }
}
