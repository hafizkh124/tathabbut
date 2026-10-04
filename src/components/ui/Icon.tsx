import React from "react";
import { ICON_PATHS, type IconKey } from "@/lib/gradeStyle";

/** One stroke icon, 16×16, drawn in the current text colour. Decorative unless a label is given. */
export function Icon({ name, size = 16, strokeWidth = 2, label, className }: { name: IconKey; size?: number; strokeWidth?: number; label?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "bang" || name === "question" ? strokeWidth + 0.4 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flex: "none" }}
    >
      {name === "info" && <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />}
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
