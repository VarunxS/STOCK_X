import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import './globals.css'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'STOCK X — Modern Equity Investment Research',
  description: 'The operating system for modern stock research. Grounded fundamental decision memos and interactive DataPulse Agent for retail and institutional investors.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={cn("min-h-screen bg-white text-slate-900 antialiased font-sans")}
        style={{
          ['--font-sans' as '--font-sans']: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          ['--font-mono' as '--font-mono']: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
        } as CSSProperties}
      >
        {children}
      </body>
    </html>
  )
}
