'use client'

import { useState } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'

import { createBrowserQueryClient } from '@/lib/query/query-client'

/** 브라우저 QueryClient 는 한 번만 만든다. 렌더마다 새로 만들면 캐시가 사라진다 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(createBrowserQueryClient)

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
