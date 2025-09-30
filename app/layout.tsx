import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from '@/lib/auth/auth-context'
import { AppClientShell } from '@/components/providers/AppClientShell'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Traveal - Intelligent Itinerary Builder',
  description: 'Build amazing travel itineraries with AI-powered destination discovery and smart planning tools.',
  keywords: ['travel', 'itinerary', 'planning', 'destinations', 'AI', 'travel planning'],
  authors: [{ name: 'Traveal Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${playfairDisplay.variable} font-body bg-gradient-dark min-h-screen antialiased`}>
        <AuthProvider>
          <AppClientShell>
            {children}
          </AppClientShell>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
