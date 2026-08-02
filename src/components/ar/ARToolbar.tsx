"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";

export interface ARToolbarProps {
  hasSelection: boolean;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onDelete: () => void;
  onSave: () => void;
  onClear: () => void;
  onExit: () => void;
  objectCount: number;
}

export function ARToolbar({
  hasSelection,
  onRotateLeft,
  onRotateRight,
  onDelete,
  onSave,
  onClear,
  onExit,
  objectCount,
}: ARToolbarProps) {
  return (
    <>
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <GlassPanel
          variant="dark"
          rounded="xl"
          className="px-4 py-2 pointer-events-auto"
        >
          <p className="text-white text-sm font-medium">AR Room Stager</p>
          <p className="text-white/50 text-xs">
            {objectCount} object{objectCount !== 1 ? "s" : ""} placed
          </p>
        </GlassPanel>

        <button
          onClick={onExit}
          className="bg-red-500/80 hover:bg-red-500 backdrop-blur-md text-white font-semibold px-4 py-2 rounded-xl border border-white/10 pointer-events-auto active:scale-95 transition-all"
        >
          Exit AR
        </button>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
        <ToolbarButton
          onClick={onRotateLeft}
          disabled={!hasSelection}
          label="Rotate -15°"
        >
          ↺
        </ToolbarButton>
        <ToolbarButton
          onClick={onDelete}
          disabled={!hasSelection}
          label="Delete"
          variant="danger"
        >
          🗑
        </ToolbarButton>
        <ToolbarButton
          onClick={onRotateRight}
          disabled={!hasSelection}
          label="Rotate +15°"
        >
          ↻
        </ToolbarButton>
        <ToolbarButton
          onClick={onSave}
          label="Save Scene"
          variant="success"
        >
          💾
        </ToolbarButton>
        <ToolbarButton
          onClick={onClear}
          label="Clear All"
          variant="warning"
        >
          ✕
        </ToolbarButton>
      </div>
    </>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  label,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  variant?: "default" | "danger" | "success" | "warning";
}) {
  const variantClasses = {
    default: "bg-white/10 hover:bg-white/20",
    danger: "bg-red-500/60 hover:bg-red-500/80",
    success: "bg-emerald-500/60 hover:bg-emerald-500/80",
    warning: "bg-orange-500/60 hover:bg-orange-500/80",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`backdrop-blur-md text-white text-xl w-12 h-12 rounded-xl border border-white/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
}
