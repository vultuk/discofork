import type { Metadata } from "next"

import { buildThemeBootstrapScript } from "@/lib/theme"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "https://discofork.ai"),
  title: "Discofork",
  description: "Simple web views for cached Discofork analyses and queued repository lookups.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript() }} />
      </head>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
