import { DefaultExecutor } from "./default.js";

export function resolveAzureConfig(credentials = null, model = null) {
  const psd = credentials?.providerSpecificData || {};
  const rawEndpoint = (psd.azureEndpoint || process.env.AZURE_ENDPOINT || "https://api.openai.com").trim();
  let apiVersion = (psd.apiVersion || process.env.AZURE_API_VERSION || "").trim();
  const deployment = (psd.deployment || model || process.env.AZURE_DEPLOYMENT || "gpt-4").trim();

  let parsedUrl = null;
  try {
    parsedUrl = new URL(rawEndpoint);
  } catch {
    parsedUrl = null;
  }

  let endpointMode = psd.endpointMode;
  if (!endpointMode) {
    endpointMode = parsedUrl?.pathname?.includes("/openai/responses") ? "responses" : "deployments";
  }

  if (!apiVersion) {
    apiVersion = parsedUrl?.searchParams?.get("api-version")
      || (endpointMode === "responses" ? "2025-04-01-preview" : "2024-10-01-preview");
  }

  const origin = parsedUrl ? parsedUrl.origin : rawEndpoint.replace(/\/$/, "");
  const pathname = parsedUrl?.pathname?.replace(/\/$/, "") || "";

  let url;
  if (pathname && pathname !== "/" && (pathname.includes("/openai/responses") || pathname.includes("/openai/deployments/"))) {
    const u = new URL(origin + pathname);
    if (parsedUrl?.search) {
      u.search = parsedUrl.search;
    }
    if (!u.searchParams.has("api-version") && apiVersion) {
      u.searchParams.set("api-version", apiVersion);
    }
    url = u.toString();
  } else if (endpointMode === "responses") {
    url = `${origin}/openai/responses?api-version=${apiVersion}`;
  } else {
    url = `${origin}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }

  const authScheme = psd.authScheme || (endpointMode === "responses" ? "bearer" : "api-key");

  return { url, apiVersion, deployment, endpointMode, authScheme };
}

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
