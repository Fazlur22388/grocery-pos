import type { CSSProperties } from "react";

const paths = {
  shop: "M3 10h18M4 10v11h16V10M2 10l3-7h14l3 7M9 21v-7h6v7M8 3l-1 7m9-7 1 7",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9M7.5 5.5l9 5",
  cart: "M2 3h3l3 13h11l3-9H6M9 21h.01M18 21h.01",
  stock: "M4 4h16v5H4zM4 15h16v5H4zM8 6.5h2M8 17.5h2",
  chart: "M4 3v18h17M9 16v-5m5 5V7m5 9V4",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5",
  plus: "M12 5v14M5 12h14",
  edit: "m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  close: "m6 6 12 12M6 18 18 6",
  alert: "m12 3 10 18H2L12 3ZM12 9v5m0 3v.01",
  check: "m5 12 4 4L19 6",
  refresh: "M20 7a9 9 0 1 0 1 9M20 2v5h-5",
  tag: "M3 3h9l9 9-9 9-9-9V3Zm5 5h.01",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
