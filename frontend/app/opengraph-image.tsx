import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Radiograph AI — explainable chest X-ray screening";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0E14",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", color: "#22D3EE", fontSize: 22, letterSpacing: 2 }}>
            CHEXNET REPRODUCTION · DENSENET-121
          </div>
          <div style={{ display: "flex", color: "#E9EFF6", fontSize: 68, fontWeight: 600, lineHeight: 1.1 }}>
            Chest X-ray screening
            <br />
            with explainable AI
          </div>
          <div style={{ display: "flex", color: "#96A8BC", fontSize: 28 }}>
            14 thoracic pathologies · per-disease AUC · Grad-CAM localisation
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderTop: "1px solid #1F2A38",
            paddingTop: 24,
            color: "#5D6E82",
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 12, background: "#FBBF24" }} />
          Educational project — not a medical device
        </div>
      </div>
    ),
    size,
  );
}
