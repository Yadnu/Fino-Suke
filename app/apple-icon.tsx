import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1a1a1f 0%, #0f0f11 100%)",
          borderRadius: 40,
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: "#f5c842",
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          F
        </span>
        <div
          style={{
            position: "absolute",
            bottom: 22,
            right: 22,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#2dd4bf",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
