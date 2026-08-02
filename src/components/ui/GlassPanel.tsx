import type { ReactNode, HTMLAttributes } from "react";

type GlassVariant = "light" | "dark" | "emerald";

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: GlassVariant;
  blur?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

const variantClasses: Record<GlassVariant, string> = {
  light: "bg-white/10 border-white/20 text-white",
  dark: "bg-black/40 border-white/10 text-white",
  emerald: "bg-emerald-500/20 border-emerald-400/30 text-white",
};

const blurMap = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
};

const roundedMap = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

export function GlassPanel({
  children,
  variant = "dark",
  blur = "xl",
  rounded = "2xl",
  className = "",
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={`${variantClasses[variant]} ${blurMap[blur]} ${roundedMap[rounded]} border shadow-lg shadow-black/10 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
