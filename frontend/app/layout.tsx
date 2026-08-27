import type { Metadata } from 'next'

import { QueryProvider } from '@/lib/query/query-provider'

// Pretendard Variable — unicode-range 로 분할된 dynamic subset.
// 브라우저가 **페이지에 실제 등장한 글자 범위만** 내려받는다 (조각 평균 31KB).
// 통짜 variable(2.0MB)이나 static 9종(6.6MB) 대비 초기 로드가 압도적으로 작다.
// 자세한 근거는 docs/tooling-guide.md §12.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
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
