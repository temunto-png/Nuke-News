import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { loadDailyData } from "../../lib/data";

export const runtime = "nodejs";

const ALLOWED_THUMBNAIL_HOSTNAMES = /^([a-z0-9-]+\.)*dmm\.(co\.jp|com)$/;

function isSafeThumbnailUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_THUMBNAIL_HOSTNAMES.test(parsed.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const id = Number.parseInt(searchParams.get("id") ?? "1", 10);
  const data = loadDailyData(date);
  const item = data?.items.find((entry) => entry.id === id);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(127,29,29,1) 100%)",
          color: "white",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {item?.product.thumbnailUrl && isSafeThumbnailUrl(item.product.thumbnailUrl) ? (
          <img
            src={item.product.thumbnailUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.18,
            }}
          />
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 80px",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 26, opacity: 0.72 }}>NUKE NEWS</div>
          <div style={{ marginTop: 20, fontSize: 58, fontWeight: 700, lineHeight: 1.28 }}>
            {item?.newsTitle ?? "せっかくだから俺はこのニュースで抜くぜ"}
          </div>
          <div style={{ marginTop: 28, fontSize: 24, color: "#fecaca" }}>
            せっかくだから俺はこのニュースで抜くぜ
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
