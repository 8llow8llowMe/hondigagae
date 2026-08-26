import type { Metadata } from 'next'

import { QueryProvider } from '@/lib/query/query-provider'

import './globals.css'

export const metadata: Metadata = {
  title: '혼디가개',
  description: '반려견과 함께하는 제주 여행을 설계합니다.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
