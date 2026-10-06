import React from "react";

const PINS = {
  top: "M22 4 V11 M32 4 V11 M42 4 V11",
  right: "M53 22 H60 M53 32 H60 M53 42 H60",
  bottom: "M22 53 V60 M32 53 V60 M42 53 V60",
  left: "M4 22 H11 M4 32 H11 M4 42 H11",
} as const;

export type LogoMotion = "none" | "loading" | "done";

interface LogoMarkProps {
  size?: number;
  /** none: still · loading: pins light up in turn, dots hop, the tick draws and fades in a loop · done: the tick draws once */
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
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: "none" }}>
      {small ? (
        <rect width="64" height="64" rx="16" fill={fill} />
      ) : (
        <>
          <g stroke={gold} strokeWidth="2.8" strokeLinecap="round" fill="none">
            {(Object.keys(PINS) as Array<keyof typeof PINS>).map((side, i) => (
              <path key={side} d={PINS[side]} opacity={motion === "loading" ? 0.3 : 1}>
                {motion === "loading" && <animate attributeName="opacity" values="0.3;1;0.3" dur="1.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />}
                {motion === "done" && <animate attributeName="opacity" values="0.3;1;0.3;1" keyTimes="0;0.3;0.6;1" dur="1.4s" begin="0s" fill="freeze" />}
              </path>
            ))}
          </g>
          <rect x="9" y="9" width="46" height="46" rx="12" fill={fill} />
        </>
      )}
      <circle cx="26" cy={small ? 19 : 24} r={small ? 4.2 : 3.5} fill={gold}>
        {motion === "loading" && <animate attributeName="cy" values="24;20.5;24" dur="1s" begin="0s" repeatCount="indefinite" />}
      </circle>
      <circle cx="38" cy={small ? 19 : 24} r={small ? 4.2 : 3.5} fill={gold}>
        {motion === "loading" && <animate attributeName="cy" values="24;20.5;24" dur="1s" begin="0.25s" repeatCount="indefinite" />}
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
        {motion === "loading" && <animate attributeName="stroke-dashoffset" values="1;0;0;1" keyTimes="0;0.45;0.8;1" dur="2s" repeatCount="indefinite" />}
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
