import type { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        border: "1px solid rgba(120,120,128,0.18)",
        borderRadius: "28px",
        backdropFilter: "blur(24px)",
        background: "rgba(255,255,255,0.62)",
        boxShadow: "0 24px 60px rgba(12, 18, 28, 0.08)"
      }}
    >
      {children}
    </div>
  );
}
