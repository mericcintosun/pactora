import { ImageResponse } from "next/og";

export const alt = "Pactora: pre-orders that only charge when the batch is real";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Palette from IDENTITY.md (ImageResponse cannot read CSS variables).
const GROUND = "#f2efe8";
const INK = "#111111";
const ACCENT = "#d8261c";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: GROUND, position: "relative", fontFamily: "Georgia, serif" }}>
        <div
          style={{
            position: "absolute", top: 0, right: -160, width: 560, height: 630, background: INK,
            transform: "skewX(-14deg)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", padding: 72, width: 780, color: INK }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 64, height: 64, border: `6px solid ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <div style={{ width: 46, height: 6, background: ACCENT, transform: "rotate(-32deg)" }} />
            </div>
            <div style={{ fontSize: 64, fontWeight: 700 }}>Pactora</div>
          </div>
          <div style={{ marginTop: 56, fontSize: 58, fontWeight: 700, lineHeight: 1.08 }}>Nobody pays until</div>
          <div style={{ marginTop: 8, fontSize: 58, fontWeight: 700, background: INK, color: GROUND, padding: "4px 14px", alignSelf: "flex-start" }}>
            the batch is real.
          </div>
          <div style={{ marginTop: 40, fontSize: 28, lineHeight: 1.35, fontFamily: "Arial, sans-serif" }}>
            Buyers sign once. Enough orders and every payment moves in one transaction. Not enough and nothing moves at all.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
