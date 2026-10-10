'use client'

import { useQuery } from '@tanstack/react-query'

import { PET_QUERY_OPTIONS, petKeys } from '@/features/pet/queries'
import { clientFetch } from '@/lib/api/client'
import { petListPath } from '@/lib/api/pet'
import type { PetList } from '@/types/pet'

/**
 * 내 반려견 목록.
 *
 * **`authed` 가 필수 인자다** (#200). 보호 리소스라 미로그인에는 **조회조차 보내지 않는다** —
 * `(main)/layout.tsx` 의 서버 프리페치가 이미 `session !== null` 로 막고 있는데
 * (전역nav-세부명세 D3) 클라이언트 훅만 그 의도를 따르지 않아, 게스트가 홈에 들어올 때마다
 * `GET /members/me/pets` 403 이 나가고 있었다 (dev 실측).
 *
 * **선택 인자로 두지 않았다.** 기본값을 주면 안 넘긴 호출부가 예전 동작으로 조용히
 * 돌아간다 — 지금 고치는 결함이 정확히 그 모양이었다. 필수로 두면 새 호출부가 생길 때
 * 컴파일이 "이 화면은 로그인 상태를 아는가" 를 묻는다.
 *
 * `authed` 는 서버 컴포넌트가 `readSession()` 으로 판정해 prop 으로 내려준다. 클라이언트에
 * 세션 파생 store 를 새로 두지 않은 이유는 이 훅을 쓰는 화면이 전부 서버 컴포넌트 아래에
 * 있어 값을 이미 갖고 있거나 쉽게 받을 수 있기 때문이다.
 */
export function usePetList(authed: boolean) {
  return useQuery({
    queryKey: petKeys.list(),
    queryFn: () => clientFetch<PetList>(petListPath()),
    /*
      **`enabled: false` 는 캐시를 지우지 않는다.** 로그아웃 직후에도 이전 목록이 캐시에
      남아 있을 수 있는데, 그건 세션 종료가 `queryClient` 를 비우는 쪽에서 다룬다
      (`use-session-exit.ts`). 여기서 할 일은 요청을 내지 않는 것뿐이다.
    */
    enabled: authed,
    staleTime: PET_QUERY_OPTIONS.staleTime,
    gcTime: PET_QUERY_OPTIONS.gcTime,
    retry: PET_QUERY_OPTIONS.retry,
  })
}
