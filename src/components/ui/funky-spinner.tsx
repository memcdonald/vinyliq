"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const phrases = [
  "Unfucking the mix...",
  "Screaming at the sound guy...",
  "Blowing a goddamn tube...",
  "Hotboxing the green room...",
  "Duct-taping the kick drum...",
  "Bitching about monitors...",
  "Loading the damn van...",
  "Soundchecking to hell...",
  "Feeding back like a bastard...",
  "Rewiring this piece of shit...",
  "Arguing about the setlist...",
  "Clipping the fucking master...",
  "Punching in take forty-seven...",
  "Degaussing the goddamn heads...",
  "Splicing tape like an animal...",
  "Blasting the talkback...",
  "Cranking it to fucking eleven...",
  "Wrestling a cable snake...",
  "Swearing at Pro Tools...",
  "Smashing a shitty monitor...",
  "Huffing solder fumes...",
  "Begging for more reverb...",
  "Killing the goddamn hum...",
  "Shoving a DI up the bass rig...",
  "Dropping the whole damn PA...",
  "Riding the fader like a maniac...",
];

function pick(exclude: number): number {
  let next: number;
  do {
    next = Math.floor(Math.random() * phrases.length);
  } while (next === exclude && phrases.length > 1);
  return next;
}

export function FunkySpinner({ className }: { className?: string }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * phrases.length));

  useEffect(() => {
    const id = setInterval(() => setIndex((prev) => pick(prev)), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        {phrases[index]}
      </p>
    </div>
  );
}
