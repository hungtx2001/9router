import https from "https";
import pkg from "../../../../package.json" with { type: "json" };

const GHCR_IMAGE = "hungtx2001/9router";
const VERSION_CACHE_TTL_MS = 3600000;

const versionCache = (global.__githubReleaseVersionCache ??= { value: null, fetchedAt: 0 });

async function getJson(url, headers = {}) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchLatestVersion() {
  const tokenResponse = await getJson(`https://ghcr.io/token?scope=repository:${GHCR_IMAGE}:pull`);
  if (!tokenResponse?.token) return null;
  const authHeaders = { Authorization: `Bearer ${tokenResponse.token}` };
  const index = await getJson(`https://ghcr.io/v2/${GHCR_IMAGE}/manifests/latest`, {
    ...authHeaders,
    Accept: "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json",
  });
  const image = index?.manifests?.find((item) => item.platform?.os === "linux" && item.platform?.architecture === "arm64")
    || index?.manifests?.find((item) => item.platform?.os === "linux" && item.platform?.architecture === "amd64");
  if (!image?.digest) return null;

  const manifest = await getJson(`https://ghcr.io/v2/${GHCR_IMAGE}/manifests/${image.digest}`, {
    ...authHeaders,
    Accept: "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
  });
  if (!manifest?.config?.digest) return null;
  const config = await getJson(`https://ghcr.io/v2/${GHCR_IMAGE}/blobs/${manifest.config.digest}`, authHeaders);
  const imageVersion = config?.config?.Labels?.["org.opencontainers.image.version"];
  if (typeof imageVersion === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(imageVersion)) {
    return imageVersion;
  }

  const revision = config?.config?.Labels?.["org.opencontainers.image.revision"];
  if (!/^[0-9a-f]{40}$/.test(revision || "")) return null;
  const packageFile = await getJson(`https://raw.githubusercontent.com/${GHCR_IMAGE}/${revision}/cli/package.json`);
  const version = packageFile?.version;
  return typeof version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    ? version
    : null;
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

async function getLatestVersionCached() {
  if (versionCache.value && Date.now() - versionCache.fetchedAt < VERSION_CACHE_TTL_MS) {
    return versionCache.value;
  }
  const latest = await fetchLatestVersion();
  if (latest) {
    versionCache.value = latest;
    versionCache.fetchedAt = Date.now();
  }
  return latest;
}

export async function GET() {
  const latestVersion = await getLatestVersionCached();
  const currentVersion = pkg.version;
  const hasUpdate = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;

  return Response.json({ currentVersion, latestVersion, hasUpdate });
}
