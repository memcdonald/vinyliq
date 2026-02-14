import Image from "next/image";
import Link from "next/link";
import { Disc3, Users, Heart, Star } from "lucide-react";
import { api } from "@/lib/trpc/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Metadata } from "next";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const caller = await api();
  const result = await caller.share.resolveLink({ token });

  if (!result.found) {
    return { title: "Share - VinylIQ" };
  }

  if (result.type === "album") {
    return {
      title: `${result.album.title} - Shared via VinylIQ`,
      description: `Check out ${result.album.title} on VinylIQ. ${result.album.genres.join(", ")}`,
      openGraph: {
        title: `${result.album.title} - VinylIQ`,
        description: `Shared by ${result.ownerName}. ${result.album.genres.join(", ")}`,
        images: result.album.coverImage ? [result.album.coverImage] : [],
      },
    };
  }

  if (result.type === "wantlist") {
    return {
      title: `${result.ownerName}'s Wantlist - VinylIQ`,
      description: `${result.items.length} albums on ${result.ownerName}'s wantlist`,
      openGraph: {
        title: `${result.ownerName}'s Wantlist - VinylIQ`,
        description: `${result.items.length} albums`,
      },
    };
  }

  return { title: "Share - VinylIQ" };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const caller = await api();
  const result = await caller.share.resolveLink({ token });

  if (!result.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Disc3 className="mb-4 h-12 w-12 text-primary" />
        <h1 className="mb-2 text-2xl font-bold">Link Not Found</h1>
        <p className="mb-6 text-muted-foreground">
          This share link may have expired or been revoked.
        </p>
        <Button asChild>
          <Link href="/sign-up">Join VinylIQ</Link>
        </Button>
      </div>
    );
  }

  if (result.type === "album") {
    const album = result.album;

    return (
      <div className="min-h-screen bg-background">
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <Disc3 className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold tracking-tight">VinylIQ</span>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Shared by {result.ownerName}
          </p>

          <div className="grid gap-8 sm:grid-cols-[280px_1fr]">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
              {album.coverImage || album.thumb ? (
                <Image
                  src={album.coverImage || album.thumb || ""}
                  alt={album.title}
                  fill
                  sizes="280px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Disc3 className="h-16 w-16 text-muted-foreground/40" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">{album.title}</h1>
              {album.year && (
                <p className="text-muted-foreground">{album.year}</p>
              )}

              {album.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {album.genres.map((genre) => (
                    <Badge key={genre} variant="default">
                      {genre}
                    </Badge>
                  ))}
                  {album.styles.map((style) => (
                    <Badge key={style} variant="secondary">
                      {style}
                    </Badge>
                  ))}
                </div>
              )}

              <Separator />

              <div className="flex flex-wrap gap-6">
                {album.communityHave !== null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {album.communityHave?.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">have</span>
                  </div>
                )}
                {album.communityWant !== null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {album.communityWant?.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">want</span>
                  </div>
                )}
                {album.communityRating !== null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {album.communityRating?.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">/ 5</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              Track your vinyl collection with VinylIQ
            </p>
            <Button asChild size="lg">
              <Link href="/sign-up">Sign Up Free</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (result.type === "wantlist") {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <Disc3 className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold tracking-tight">VinylIQ</span>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {result.ownerName}&apos;s Wantlist
            </h1>
            <p className="text-sm text-muted-foreground">
              {result.items.length} {result.items.length === 1 ? "album" : "albums"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {result.items.map((item) => (
              <Card key={item.id} className="h-full overflow-hidden py-0">
                <div className="relative aspect-square w-full overflow-hidden bg-muted">
                  {item.thumb || item.coverImage ? (
                    <Image
                      src={item.coverImage || item.thumb || ""}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Disc3 className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-1.5 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                    {item.title}
                  </h3>
                  {item.year && (
                    <p className="text-xs text-muted-foreground">{item.year}</p>
                  )}
                  {item.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.genres.slice(0, 2).map((g) => (
                        <Badge
                          key={g}
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator className="my-8" />

          <div className="text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              Track your vinyl collection with VinylIQ
            </p>
            <Button asChild size="lg">
              <Link href="/sign-up">Sign Up Free</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
