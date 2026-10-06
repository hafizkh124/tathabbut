import React from "react";

const PINS = {
  top: "M22 4 V11 M32 4 V11 M42 4 V11",
  right: "M53 22 H60 M53 32 H60 M53 42 H60",
  bottom: "M22 53 V60 M32 53 V60 M42 53 V60",
  left: "M4 22 H11 M4 32 H11 M4 42 H11",
} as const;

/** The twelve pins one by one, clockwise from the top left, for the waiting animation. */
const PINS_CLOCKWISE = [
  ...[22, 32, 42].map((x) => `M${x} 4 V11`),
  ...[22, 32, 42].map((y) => `M53 ${y} H60`),
  ...[42, 32, 22].map((x) => `M${x} 53 V60`),
  ...[42, 32, 22].map((y) => `M4 ${y} H11`),
];

/** One waiting loop, in seconds: the dots drop in and bounce once, one after the other, then the tick draws, holds and goes. */
const LOOP = 3.6;

/** A dot dropping in at `t` (a fraction of the loop), bouncing once where it lands, and staying until the loop ends. */
function DotDrop({ cy, t }: { cy: number; t: number }) {
  const k = (n: number) => n.toFixed(2);
  return (
    <>
      <animate attributeName="opacity" values="0;0;1;1;0" keyTimes={`0;${k(t)};${k(t + 0.06)};0.9;1`} dur={`${LOOP}s`} repeatCount="indefinite" />
      <animate
        attributeName="cy"
        values={`${cy - 10};${cy - 10};${cy};${cy - 3.5};${cy};${cy}`}
        keyTimes={`0;${k(t)};${k(t + 0.08)};${k(t + 0.14)};${k(t + 0.2)};1`}
        dur={`${LOOP}s`}
        repeatCount="indefinite"
      />
    </>
  );
}

export type LogoMotion = "none" | "loading" | "done";

interface LogoMarkProps {
  size?: number;
  /** none: still · loading: the pins light up one by one round the chip while the dots drop in and bounce and the tick draws, in a loop · done: the tick draws once */
  motion?: LogoMotion;
  /** the colour of the chip body; use `soft` on a teal background */
  body?: "brand" | "soft";
  label?: string;
}

/** The logo: the letter ت (two dots over a tick) inside an AI chip with pins on all four sides. Under 32px the pins are dropped. */
export function LogoMark({ size = 36, motion = "none", body = "brand", label }: LogoMarkProps) {
  const fill = body === "soft" ? "#14524D" : "#0B3D3A";
  const small = size < 32;
  const gold = "#C8A24A";
  const loading = motion === "loading";
  const dotY = small ? 19 : 24;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: "none" }}>
      {small ? (
        <rect width="64" height="64" rx="16" fill={fill} />
      ) : (
        <>
          <g stroke={gold} strokeWidth="2.8" strokeLinecap="round" fill="none">
            {loading
              ? PINS_CLOCKWISE.map((d, i) => (
                  <path key={d} d={d} opacity={0.2}>
                    <animate attributeName="opacity" values="1;0.2;0.2" keyTimes="0;0.35;1" dur="1.2s" begin={`${(i * 0.1).toFixed(1)}s`} repeatCount="indefinite" />
                  </path>
                ))
              : (Object.keys(PINS) as Array<keyof typeof PINS>).map((side) => (
                  <path key={side} d={PINS[side]}>
                    {motion === "done" && <animate attributeName="opacity" values="0.3;1;0.3;1" keyTimes="0;0.3;0.6;1" dur="1.4s" begin="0s" fill="freeze" />}
                  </path>
                ))}
          </g>
          <rect x="9" y="9" width="46" height="46" rx="12" fill={fill} />
        </>
      )}
      <circle cx="26" cy={dotY} r={small ? 4.2 : 3.5} fill={gold} opacity={loading ? 0 : undefined}>
        {loading && <DotDrop cy={dotY} t={0.3} />}
      </circle>
      <circle cx="38" cy={dotY} r={small ? 4.2 : 3.5} fill={gold} opacity={loading ? 0 : undefined}>
        {loading && <DotDrop cy={dotY} t={0.38} />}
      </circle>
      <path
        d={small ? "M15 36 L28 48 L49 27" : "M19 36 L28.5 45 L45 28"}
        pathLength={1}
        strokeDasharray={motion === "none" ? undefined : 1}
        strokeDashoffset={motion === "none" ? undefined : 1}
        fill="none"
        stroke={gold}
        strokeWidth={small ? 6.6 : 5.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {loading && <animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes="0;0.6;0.74;0.9;1" dur={`${LOOP}s`} repeatCount="indefinite" />}
        {motion === "done" && <animate attributeName="stroke-dashoffset" values="1;0" dur="0.6s" fill="freeze" />}
      </path>
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="font-bold leading-none text-[color:var(--wordmark)]" style={{ fontSize: size, fontFamily: "var(--font-readex), sans-serif" }} lang="ar">
      تَثَبُّت
    </span>
  );
}
