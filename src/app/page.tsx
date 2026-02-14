import Image from "next/image";
import Link from "next/link";
import { Search, Library, Heart, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-3">
          <Image
            src="/mark.png"
            alt="VinylIQ"
            width={48}
            height={48}
            className="drop-shadow-[0_0_12px_rgba(124,92,255,0.5)]"
          />
          <h1 className="text-5xl font-bold tracking-tight font-serif-display">VinylIQ</h1>
        </div>

        <p className="text-lg text-muted-foreground">
          Research, collect, and discover vinyl records
        </p>

        <ul className="flex flex-col gap-3 text-left text-sm text-muted-foreground">
          <li className="flex items-center gap-3">
            <Search className="size-4 shrink-0 text-primary" />
            <span>
              Search millions of releases with detailed pressing information
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Library className="size-4 shrink-0 text-primary" />
            <span>
              Track your vinyl collection with current market values
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Heart className="size-4 shrink-0 text-primary" />
            <span>
              Build a wantlist and get notified when prices drop
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Compass className="size-4 shrink-0 text-primary" />
            <span>
              Discover new music based on your collection and taste
            </span>
          </li>
        </ul>

        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/sign-up">Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
