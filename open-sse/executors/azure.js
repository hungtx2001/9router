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
    if (body && !body.model && model) {
      return { ...body, model };
    }
    return body;
  }
}
