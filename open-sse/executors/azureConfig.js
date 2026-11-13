export function resolveAzureConfig(credentials = null, model = null) {
  const psd = credentials?.providerSpecificData || {};
  const rawEndpoint = (psd.azureEndpoint || process.env.AZURE_ENDPOINT || "https://api.openai.com").trim();
  let apiVersion = (psd.apiVersion || process.env.AZURE_API_VERSION || "").trim();
  const parsedUrl = URL.canParse(rawEndpoint) ? new URL(rawEndpoint) : null;
  const deployment = (psd.deployment || model || process.env.AZURE_DEPLOYMENT || "gpt-4").trim();
  apiVersion ||= parsedUrl?.searchParams.get("api-version") || "2024-10-01-preview";

  const origin = parsedUrl?.origin || rawEndpoint.replace(/\/$/, "");
  const pathname = parsedUrl?.pathname.replace(/\/$/, "") || "";
  const deploymentPath = /^\/openai\/deployments\/[^/]+\/chat\/completions$/.test(pathname)
    ? pathname
    : `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions`;
  const url = new URL(deploymentPath, `${origin}/`);
  if (parsedUrl) {
    for (const [key, value] of parsedUrl.searchParams) {
      if (key !== "api-version") url.searchParams.append(key, value);
    }
  }
  url.searchParams.set("api-version", apiVersion);

  return { url: url.toString(), apiVersion, deployment, endpointMode: "deployments", authScheme: "api-key" };
}
