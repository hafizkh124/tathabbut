import React, { useId } from "react";

export type LogoMotion = "none" | "loading" | "done";

/** The two strokes of the mark: the body of the letter ت, then the tick rising out of it. */
const LETTER = "M34 62 C42 48 51 48 57 59 C62 49 69 49 76 58";
const TICK = "M76 58 L100 30";

/** SVG ids from useId, kept to characters every browser accepts inside url(#…). */
function useSvgId(): string {
  return `t${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

interface LogoMarkProps {
  size?: number;
  /** none: still · loading: the letter and the tick draw and fade in a loop · done: they draw once */
  motion?: LogoMotion;
  label?: string;
}

/** The logo: the letter ت drawn in gold on a deep teal tile, its last stroke rising into a tick, over a faint baseline. */
export function LogoMark({ size = 36, motion = "none", label }: LogoMarkProps) {
  const id = useSvgId();
  const animated = motion !== "none";
  const stroke = { fill: "none", stroke: `url(#${id}g)`, strokeWidth: 11.5, strokeLinecap: "round", strokeLinejoin: "round", pathLength: 1 } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: "none" }}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EBD08A" />
          <stop offset=".5" stopColor="#C7A24A" />
          <stop offset="1" stopColor="#B08A38" />
        </linearGradient>
        <linearGradient id={`${id}d`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#114E49" />
          <stop offset="1" stopColor="#0A3835" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="116" height="116" rx="30" fill={`url(#${id}d)`} />
      <line x1="34" y1="88" x2="94" y2="88" stroke="#EBD08A" strokeWidth="2.5" opacity=".3" strokeLinecap="round" />
      <circle cx="34" cy="88" r="2.6" fill="#EBD08A" opacity=".5">
        {motion === "loading" && <animate attributeName="cx" values="34;94;34" dur="2.4s" repeatCount="indefinite" />}
      </circle>
      <path d={LETTER} {...stroke} strokeDasharray={animated ? 1 : undefined} strokeDashoffset={animated ? 1 : undefined}>
        {motion === "loading" && <animate attributeName="stroke-dashoffset" values="1;0;0;1" keyTimes="0;0.35;0.8;1" dur="2.4s" repeatCount="indefinite" />}
        {motion === "done" && <animate attributeName="stroke-dashoffset" values="1;0" dur="0.45s" fill="freeze" />}
      </path>
      <path d={TICK} {...stroke} strokeDasharray={animated ? 1 : undefined} strokeDashoffset={animated ? 1 : undefined}>
        {motion === "loading" && <animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes="0;0.35;0.5;0.8;1" dur="2.4s" repeatCount="indefinite" />}
        {motion === "done" && <animate attributeName="stroke-dashoffset" values="1;1;0" keyTimes="0;0.6;1" dur="0.7s" fill="freeze" />}
      </path>
    </svg>
  );
}

/** Waiting for an answer: a gold arc turning round a tick, on the page's own colours. */
export function LoadingMark({ size = 120, label }: { size?: number; label?: string }) {
  const id = useSvgId();
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: "none" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EBD08A" />
          <stop offset="1" stopColor="#C7A24A" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="52" fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="64" cy="64" r="52" fill="none" stroke={`url(#${id})`} strokeWidth="6" strokeLinecap="round" strokeDasharray="150 230" transform="rotate(-90 64 64)">
        <animateTransform attributeName="transform" type="rotate" from="-90 64 64" to="270 64 64" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <path d="M44 66 56 78 86 44" fill="none" stroke={`url(#${id})`} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="font-bold leading-none text-brand-ink" style={{ fontSize: size, fontFamily: "var(--font-readex), sans-serif" }} lang="ar">
      تَثَبُّت
    </span>
  );
}
