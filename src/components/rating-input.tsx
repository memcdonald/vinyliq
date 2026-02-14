"use client";

import { cn } from "@/lib/utils";

interface RatingInputProps {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

const SEGMENT_COLORS = [
  "bg-red-500",       // 1
  "bg-red-400",       // 2
  "bg-orange-500",    // 3
  "bg-orange-400",    // 4
  "bg-yellow-500",    // 5
  "bg-yellow-400",    // 6
  "bg-lime-500",      // 7
  "bg-green-400",     // 8
  "bg-green-500",     // 9
  "bg-emerald-500",   // 10
] as const;

export function RatingInput({ value, onChange, disabled }: RatingInputProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => {
          const rating = i + 1;
          const isSelected = value !== null && rating <= value;

          return (
            <button
              key={rating}
              type="button"
              disabled={disabled}
              onClick={() => onChange(rating)}
              className={cn(
                "h-6 w-4 rounded-sm transition-all hover:scale-110",
                isSelected ? SEGMENT_COLORS[i] : "bg-muted hover:bg-muted-foreground/20",
                disabled && "cursor-not-allowed opacity-50",
              )}
              title={`${rating}/10`}
            />
          );
        })}
      </div>
      {value !== null && (
        <span className="min-w-[2ch] text-sm font-medium tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}
