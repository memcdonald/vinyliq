"use client";

import { cn } from "@/lib/utils";

interface CollectabilityBadgeProps {
  score: number | null;
  size?: "sm" | "md";
}

export function CollectabilityBadge({ score, size = "sm" }: CollectabilityBadgeProps) {
  if (score === null || score === undefined) return null;

  const rounded = Math.round(score);

  let colorClass: string;
  let label: string;

  if (rounded >= 70) {
    colorClass = "bg-success/15 text-success";
    label = "High";
  } else if (rounded >= 40) {
    colorClass = "bg-acid-halo/15 text-acid-halo";
    label = "Medium";
  } else {
    colorClass = "bg-destructive/15 text-destructive";
    label = "Low";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        colorClass,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
      title={`Collectability: ${rounded}/100 (${label})`}
    >
      {rounded}
    </span>
  );
}
