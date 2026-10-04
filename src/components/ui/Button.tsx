import React from "react";

const VARIANTS = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover border-transparent",
  secondary: "bg-surface text-ink border-line-strong hover:bg-paper",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink underline underline-offset-4",
} as const;

const SIZES = {
  md: "min-h-12 px-5 text-[15px] rounded-xl",
  lg: "min-h-[54px] px-6 text-[17px] rounded-2xl",
  sm: "min-h-11 px-3 text-[13px] rounded-lg",
} as const;

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  full?: boolean;
};

export function Button({ variant = "primary", size = "md", full, className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`nastaliq-pad inline-flex items-center justify-center gap-2 border-[1.5px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${VARIANTS[variant]} ${SIZES[size]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}
