import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = parseInt(searchParams.get("size") ?? "512", 10);

  const iconSize = [192, 512].includes(size) ? size : 512;
  const fontSize = Math.round(iconSize * 0.42);
  const dotSize = Math.round(iconSize * 0.075);
  const dotOffset = Math.round(iconSize * 0.18);

  return new ImageResponse(
    (
      <div
        style={{
          width: iconSize,
          height: iconSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1a1a1f 0%, #0f0f11 100%)",
          borderRadius: iconSize * 0.22,
          position: "relative",
        }}
      >
        {/* Gold "F" lettermark */}
        <span
          style={{
            fontSize,
            fontWeight: 800,
            color: "#f5c842",
            fontFamily: "sans-serif",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            marginTop: iconSize * -0.02,
          }}
        >
          F
        </span>
        {/* Teal accent dot */}
        <div
          style={{
            position: "absolute",
            bottom: dotOffset,
            right: dotOffset,
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: "#2dd4bf",
          }}
        />
      </div>
    ),
    { width: iconSize, height: iconSize }
  );
}
