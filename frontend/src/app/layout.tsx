import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/providers/query-provider'

export const metadata: Metadata = {
  title: 'CRM',
  description: 'Customer Relationship Management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
