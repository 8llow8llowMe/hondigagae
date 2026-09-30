import { describe, expect, it } from 'vitest'

import { enterSession } from '@/features/auth/enter-session'

function fakes() {
  const calls: string[] = []
  return {
    calls,
    queryClient: { clear: () => void calls.push('clear') },
    location: { replace: (href: string) => void calls.push(`location.replace:${href}`) },
  }
}

describe('enterSession', () => {
  /*
    **문서 전체를 새로 받는 이동이다 — `router.replace` 가 아니다** (#1075).

    Next 라우터의 route cache 는 URL → 라우트 트리를 기억하고, 비로그인 때 `/pets/new` 로
    클라이언트 이동했다가 proxy 가 `/login?returnTo=…` 로 보낸 기록을 **`/pets/new` 의 트리 =
    로그인 화면** 으로 남긴다. 그 뒤 `router.replace('/pets/new')` 는 요청 없이 캐시를 써서
    로그인 화면에 머물고, `router.refresh()` 가 그 자리를 새 쿠키로 다시 그려
    `LoggedInNotice` 가 뜬다. `refresh` 는 segment cache 만 비우고 route cache 는 그대로
    둔다(`next/dist/client/components/router-reducer/reducers/refresh-reducer.js`).

    이 줄이 `router.replace` 로 돌아가면 증상이 되살아난다.
  */
  it('캐시를 비우고 복귀 경로를 문서째 새로 받는다', () => {
    const { calls, queryClient, location } = fakes()

    enterSession({ queryClient, location }, '/plans')

    expect(calls).toEqual(['clear', 'location.replace:/plans'])
  })
})
