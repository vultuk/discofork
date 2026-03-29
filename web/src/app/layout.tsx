import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "Discofork",
  description: "Simple web views for cached Discofork analyses and queued repository lookups.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
