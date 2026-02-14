import type { Metadata } from "next";
import {
  Noto_Serif_Display,
  Noto_Sans_Display,
  Noto_Sans,
} from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";

const notoSerifDisplay = Noto_Serif_Display({
  variable: "--font-noto-serif-display",
  subsets: ["latin"],
});

const notoSansDisplay = Noto_Sans_Display({
  variable: "--font-noto-sans-display",
  subsets: ["latin"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});

const dejaVuMono = localFont({
  src: "../fonts/DejaVuSansMono.woff2",
  variable: "--font-dejavu-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VinylIQ - Vinyl Record Research & Collection",
    template: "%s | VinylIQ",
  },
  description:
    "Research, collect, and discover vinyl records. Browse detailed release information, track your collection, manage your wantlist, and get personalized recommendations.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
  icons: {
    icon: "/favicon.ico",
    apple: "/appicon.png",
  },
  openGraph: {
    type: "website",
    siteName: "VinylIQ",
    title: "VinylIQ - Vinyl Record Research & Collection",
    description:
      "Research, collect, and discover vinyl records with data from Discogs, MusicBrainz, and Spotify.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoSerifDisplay.variable} ${notoSansDisplay.variable} ${notoSans.variable} ${dejaVuMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <TRPCProvider>
            {children}
            <Toaster />
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
