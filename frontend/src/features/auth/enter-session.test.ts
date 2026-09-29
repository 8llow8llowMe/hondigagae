import { describe, expect, it } from 'vitest'

import { enterSession } from '@/features/auth/enter-session'

function fakes() {
  const calls: string[] = []
  return {
    calls,
    queryClient: { clear: () => void calls.push('clear') },
    router: {
      replace: (href: string) => void calls.push(`replace:${href}`),
      refresh: () => void calls.push('refresh'),
    },
  }
}

describe('enterSession', () => {
  /*
    **`refresh` 는 헤더를 새 세션으로 다시 그리게 하는 방어다** (#1013). 헤더의 `authed` 는
    `(main)` 레이아웃(서버 컴포넌트)이 정하고, `queryClient.clear()` 는 서버 컴포넌트를
    다시 그리지 않는다. 이 줄이 빠지면 로그아웃(`replace` + `refresh`)과 짝이 깨진다.
  */
  it('캐시를 비우고 복귀 경로로 옮긴 뒤 서버 컴포넌트를 다시 받는다', () => {
    const { calls, queryClient, router } = fakes()

    enterSession({ queryClient, router }, '/plans')

    expect(calls).toEqual(['clear', 'replace:/plans', 'refresh'])
  })
})
