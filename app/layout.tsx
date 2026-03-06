import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import SessionProvider from '@/components/SessionProvider'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Restaurant Finance',
  description: 'Financial management for your restaurant',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className={`${geist.className} antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
