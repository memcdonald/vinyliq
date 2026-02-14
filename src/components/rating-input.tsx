"use client";

import { cn } from "@/lib/utils";

interface RatingInputProps {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

const SEGMENT_COLORS = [
  "bg-destructive",      // 1
  "bg-destructive",      // 2
  "bg-wine-rose",        // 3
  "bg-wine-rose",        // 4
  "bg-primary",          // 5
  "bg-primary",          // 6
  "bg-primary",          // 7
  "bg-success",          // 8
  "bg-success",          // 9
  "bg-success",          // 10
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
