import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Only Andey — Good eggs. Right to your room.',
  description: 'Fresh boiled and raw eggs delivered to your hostel room. Tap to order, enjoy quantity discounts, and pay when we deliver.',
  generator: 'v0.app',
  icons: {
    icon: '/Screenshot_2026-10-02_at_1.45.42_AM-removebg-preview.png',
    apple: '/Screenshot_2026-10-02_at_1.45.42_AM-removebg-preview.png',
  },
  openGraph: {
    title: 'Only Andey — Good eggs. Right to your room.',
    description: 'Fresh boiled and raw eggs delivered to your hostel room. Tap to order, enjoy quantity discounts, and pay when we deliver.',
    images: [{
      url: '/Screenshot_2026-10-02_at_1.45.42_AM-removebg-preview.png',
      width: 500,
      height: 500,
      alt: 'Only Andey Logo',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Only Andey — Good eggs. Right to your room.',
    description: 'Fresh boiled and raw eggs delivered to your hostel room. Tap to order, enjoy quantity discounts, and pay when we deliver.',
    images: ['/Screenshot_2026-10-02_at_1.45.42_AM-removebg-preview.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ef4e2f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
