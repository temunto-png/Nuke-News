const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 15 * 1000;

function getJstDateString(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function main() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://nukenews.vercel.app").replace(/\/+$/, "");
  const date = process.argv[2] ?? getJstDateString();
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  const targetUrl = `${siteUrl}/${date}`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(targetUrl, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        console.log(`Published page is ready: ${targetUrl}`);
        return;
      }

      console.log(`Waiting for publish (${response.status}): ${targetUrl}`);
    } catch (error) {
      console.log(`Waiting for publish (network error): ${String(error)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for publication: ${targetUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
