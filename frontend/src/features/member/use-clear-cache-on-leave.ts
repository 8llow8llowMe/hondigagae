'use client'

import { useCallback, useEffect, useRef } from 'react'

import { useQueryClient } from '@tanstack/react-query'

/**
 * 세션을 끝낸 뒤 **이 컴포넌트가 내려갈 때** 쿼리 캐시를 비운다 (#1421). 돌려주는 함수를 부르면 예약된다.
 *
 * **바로 비우지 않는 이유.** 이동(`router.replace` · `router.refresh`)은 트랜지션이라 그사이 지금 화면이
 * 남아 있고, 호출부는 대개 그 뒤에 상태를 바꾼다(확인 창 닫기 · `setLoggingOut(false)` 등). 그 리렌더에서
 * `useQuery` 는 비워진 캐시를 보고 쿼리를 새로 만들어 **세션이 끊긴 채 다시 부른다** — 마이페이지
 * 로그아웃이 `members/me` · `members/me/pets` · `favorites/places` 401 세 건, 헤더 로그아웃이 `members/me`
 * 401 한 건을 냈다. 캐시가 남아 있는 동안의 리렌더는 그 값을 읽을 뿐 부르지 않는다.
 *
 * **비우기는 여전히 필수다** — 남겨 두면 다음 로그인 계정이 이전 사용자의 캐시를 잠시 본다. 쓰는 곳은
 * 세션이 끝나면 반드시 내려가는 컴포넌트다: 마이페이지 · 비밀번호 화면(`/login` 으로 떠난다)과 헤더의
 * 계정 메뉴(`refresh` 뒤 비로그인 헤더로 바뀌어 내려간다). React 는 한 커밋에서 내려가는 쪽의 정리를
 * 새로 선 쪽의 effect 보다 먼저 돌려, 다음 화면이 조회를 시작할 때는 이미 비어 있다.
 */
export function useClearCacheOnLeave(): () => void {
  const queryClient = useQueryClient()
  const armedRef = useRef(false)

  useEffect(
    () => () => {
      if (armedRef.current) queryClient.clear()
    },
    [queryClient],
  )

  return useCallback(() => {
    armedRef.current = true
  }, [])
}
