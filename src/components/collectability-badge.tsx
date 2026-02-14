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
    colorClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    label = "High";
  } else if (rounded >= 40) {
    colorClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    label = "Medium";
  } else {
    colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
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
