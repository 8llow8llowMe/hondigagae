'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { oauthLogin } from '@/lib/api/auth'
import { isOAuthProvider } from '@/lib/auth/oauth-provider'
import { takeReturnTo } from '@/lib/auth/oauth-return-to'

export type OAuthExchangeState =
  /** 진입 자체가 잘못됐다 — 교환을 시도하지 않는다 */
  { status: 'invalid' } | { status: 'exchanging' } | { status: 'failed'; error: unknown }

export type UseOAuthExchangeOptions = {
  /** 경로 세그먼트. 사용자가 손으로 바꿀 수 있어 목록과 대조한다 */
  provider: string
  code: string | null
  state: string | null
}

/**
 * 콜백에서 받은 `code`·`state` 를 **정확히 한 번** 세션으로 교환한다.
 *
 * **중복 실행 가드가 이 훅의 존재 이유다.** `code` 는 1회용이고 `state` 는 서버가
 * 조회와 동시에 지운다 (Redis `GETDEL` — `RedisOAuthStateStoreAdapter.consume`).
 * React StrictMode 는 개발 모드에서 effect 를 두 번 돌리므로, 가드가 없으면 **첫 호출이
 * 성공한 직후 두 번째 호출이 `AUTH_010` 으로 실패해 오류 화면이 덮인다.** 이 화면에서
 * 가장 흔한 버그이고, 프로덕션 빌드에서는 재현되지 않아 더 늦게 발견된다.
 *
 * `useRef` 는 같은 인스턴스에서 유지되므로 StrictMode 의 두 번째 호출을 막는다.
 * 의존성 배열을 비우는 것만으로는 막지 못한다 — StrictMode 는 그것과 무관하게 다시 돈다.
 *
 * React Query 를 쓰지 않는다. **캐시하면 안 되는 1회용 교환**이라 재시도·리페치·중복
 * 제거가 전부 해가 된다 (정본 D3).
 */
export function useOAuthExchange({
  provider,
  code,
  state,
}: UseOAuthExchangeOptions): OAuthExchangeState {
  const router = useRouter()
  const queryClient = useQueryClient()
  const startedRef = useRef(false)

  const isValid =
    isOAuthProvider(provider) &&
    code !== null &&
    code.length > 0 &&
    state !== null &&
    state.length > 0

  const [result, setResult] = useState<OAuthExchangeState>(
    isValid ? { status: 'exchanging' } : { status: 'invalid' },
  )

  useEffect(() => {
    if (!isValid) return
    if (startedRef.current) return
    startedRef.current = true

    void oauthLogin(provider, code, state)
      .then(() => {
        // 이전 사용자 캐시가 남으면 다른 계정의 데이터가 보인다 — login-form.tsx 와 같은 처리
        queryClient.clear()
        /*
          **`replace` 다.** `push` 면 뒤로가기로 이 주소(`?code=&state=`)에 돌아오는데,
          그때 code·state 는 이미 소모돼 실패 화면만 보게 된다. replace 는 성공과 동시에
          주소에서 두 값을 지우는 역할도 겸한다 (정본 D3-2).
        */
        router.replace(takeReturnTo())
      })
      .catch((error: unknown) => {
        setResult({ status: 'failed', error })
      })
    // 마운트 1회만 실행한다. provider/code/state 는 라우트 파라미터라 이 화면 수명 동안
    // 바뀌지 않고, 의존성에 넣으면 재실행 경로만 열린다
  }, [])

  return result
}
