'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

/**
 * 로그인 화면이 이유를 안내해야 하는 이탈.
 *
 * **자유 텍스트를 쿼리로 넘기지 않는다.** `/login` 은 이미 `signedUp=1` 처럼 **플래그**만
 * 받고 문구는 `messages` 에서 꺼내는 규약이다 (`SignupDoneNotice`). 쿼리에 문장을 실으면
 * 링크를 만든 누구나 우리 로그인 화면에 임의 문구를 띄울 수 있다.
 */
export type ReauthReason = 'password-changed' | 'password-removed' | 'withdrawn'

/**
 * 세션이 끝나는 동작 뒤처리 — **로그아웃 · 탈퇴 · 비밀번호 변경 · 소셜 전용 전환**.
 *
 * 넷이 같은 뒤처리를 필요로 하는 이유가 서로 다르다:
 *  - 로그아웃 · 탈퇴 — 사용자가 끝내려는 동작이다
 *  - **비밀번호 변경 · 소셜 전용 전환 — 서버가 refresh 쿠키를 지운다.**
 *    `MemberWebController` 가 두 응답에 `clearRefreshCookie()` 를 싣는다. 즉 재발급이
 *    불가능해져 access token 만료와 함께 세션이 끊긴다. 화면이 이걸 모른 채 남아 있으면
 *    사용자는 **다음 조작에서야** 로그아웃된 것을 알게 된다.
 *    (명세 D3 은 invalidate 만 적고 있었다 — 소스 실측으로 잡은 차이. 비밀번호 **최초
 *    설정**은 쿠키를 지우지 않으므로 여기 해당하지 않는다.)
 *
 * `queryClient.clear()` 가 필수다. 남겨 두면 다음 로그인 계정이 **이전 사용자의 캐시**를
 * 잠시 본다 — 개인정보 유출이다.
 *
 * `replace` 를 쓴다. 뒤로가기로 방금 떠난 보호 화면에 되돌아가지 않게 한다.
 */
export function useSessionExit() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useCallback(
    (reason?: ReauthReason) => {
      queryClient.clear()

      const href = reason === undefined ? '/login' : `/login?reauth=${reason}`
      router.replace(href)
      // 서버 컴포넌트가 들고 있는 세션 상태(전역 nav 등)까지 다시 그린다
      router.refresh()
    },
    [queryClient, router],
  )
}
