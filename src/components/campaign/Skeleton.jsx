/**
 * Skeleton.jsx — Shimmer placeholder primitives.
 *
 * Replaces "טוען..." text with content-shaped placeholders that match
 * the final layout. Significantly improves perceived performance.
 */
import React from "react";
import { color, radius, space } from "./_tokens.js";

const baseStyle = {
  display: "inline-block",
  background: `linear-gradient(90deg, ${color.surfaceMuted} 0%, ${color.borderDefault} 50%, ${color.surfaceMuted} 100%)`,
  backgroundSize: "800px 100%",
  animation: "campaign-shimmer 1.4s ease-in-out infinite",
  borderRadius: radius.sm,
};

export function SkeletonLine({ width = "100%", height = 14, style = {} }) {
  return <span style={{ ...baseStyle, width, height, borderRadius: radius.sm, ...style }} />;
}

export function SkeletonBlock({ width = "100%", height = 80, style = {} }) {
  return <span style={{ ...baseStyle, width, height, borderRadius: radius.md, display: "block", ...style }} />;
}

export function SkeletonCircle({ size = 32 }) {
  return <span style={{ ...baseStyle, width: size, height: size, borderRadius: "50%" }} />;
}

export function SkeletonCard() {
  return (
    <div style={{
      background: color.surface, borderRadius: radius.card,
      border: `1px solid ${color.borderSubtle}`, padding: space(5),
      marginBottom: space(3),
    }}>
      <div style={{ display: "flex", gap: space(3), marginBottom: space(3), alignItems: "center" }}>
        <SkeletonCircle size={36} />
        <div style={{ flex: 1 }}>
          <SkeletonLine width="40%" height={16} style={{ marginBottom: 6 }} />
          <SkeletonLine width="25%" height={11} />
        </div>
      </div>
      <SkeletonBlock height={50} />
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: space(3), marginTop: space(2),
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: color.surfaceMuted, padding: space(3), borderRadius: radius.md,
        }}>
          <SkeletonLine width="50%" height={10} style={{ marginBottom: 6 }} />
          <SkeletonLine width="70%" height={14} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 3 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          padding: space(3), marginBottom: space(2),
          border: `1px solid ${color.borderSubtle}`, borderRadius: radius.md,
        }}>
          <SkeletonLine width="60%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonLine width="30%" height={11} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBoard() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: space(3),
    }}>
      {[1, 2, 3].map(c => (
        <div key={c} style={{
          background: color.surfaceMuted, borderRadius: radius.card,
          border: `1px solid ${color.borderSubtle}`, padding: space(3),
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: space(3) }}>
            <SkeletonLine width={80} height={13} />
            <SkeletonLine width={24} height={13} />
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}
