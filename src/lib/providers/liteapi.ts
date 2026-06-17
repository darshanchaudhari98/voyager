// LiteAPI client (https://docs.liteapi.travel).
// Hotels + Flights live inventory via the v3.0 API. Auth is an X-API-Key header.
// Returns null when the key is missing so callers can fall back to sample data.

function baseUrl(): string {
  return process.env.LITEAPI_BASE_URL || "https://api.liteapi.travel/v3.0";
}

export function liteapiConfigured(): boolean {
  return Boolean(process.env.LITEAPI_API_KEY);
}

function headers(): HeadersInit {
  return {
    "X-API-Key": process.env.LITEAPI_API_KEY ?? "",
    accept: "application/json",
    "content-type": "application/json",
  };
}

export async function liteapiGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T | null> {
  if (!liteapiConfigured()) return null;
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  );
  const url = `${baseUrl()}${path}${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`LiteAPI GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function liteapiPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T | null> {
  if (!liteapiConfigured()) return null;
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LiteAPI POST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}
