import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { PET_INVALIDATE_KEY, petKeys } from '@/features/pet/queries'
import { planKeys } from '@/features/plan/queries'

/**
 * 반려견 삭제 성공 뒤 무효화 (#1042).
 *
 * | 대상                                 | 처리                     | 왜                                                              |
 * | ------------------------------------ | ------------------------ | --------------------------------------------------------------- |
 * | `petKeys.all` (지운 아이 상세 제외)  | 무효화 + 재조회          | 목록 `totalCount` · 대표견 승계 (수정-세부명세 D3)              |
 * | `planKeys.all` (지운 아이 집계 제외) | 무효화 + 재조회          | 다견 일정의 `petIds` 에서 이미 빠져 있다 (plan-service 트리거)  |
 * | 지운 아이 상세 · 동행 일정 집계      | **낡음 표시만, 안 받음** | 받으면 상세는 404, 집계는 0/0/0 이다 — 아래                     |
 *
 * **지운 아이의 상세를 다시 받지 않는다.** 삭제 직후 `GET /members/me/pets/{id}` 404 가 한 번
 * 나던 원인이 여기였다 — `router.replace('/pets')` 가 화면을 내리기 전이라 `PetEditView` 가
 * 아직 그 상세를 관찰하고 있고, 관찰 중인 쿼리는 무효화되는 즉시 다시 받는다.
 *
 * **`removeQueries` 로 지우지 않는다.** 관찰자가 붙은 채로 캐시에서 빼면 다음 렌더에
 * `useQuery` 가 같은 key 로 새 쿼리를 만들고 데이터가 없으니 **곧바로 받는다** — 같은 404 가
 * 한 박자 늦게 날 뿐이다. `refetchType: 'none'` 은 낡았다는 표시만 남기므로, 10분(gcTime)
 * 안에 누가 같은 key 를 다시 관찰하면 그때 받아 404 로 정직하게 떨어진다.
 *
 * **동행 일정 집계도 같다.** 확인창이 삭제 응답이 올 때까지 열려 있고 그 집계를 관찰한다 —
 * 다시 받으면 지운 뒤의 0 / 0 / 0 이 와서 확인창의 문장이 스피너 옆에서 사라진다.
 */
export async function invalidateAfterPetDeleted(
  queryClient: QueryClient,
  petId: string,
): Promise<void> {
  const deletedDetail = petKeys.detail(petId)
  const deletedSummary = planKeys.companions(petId)

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: PET_INVALIDATE_KEY,
      predicate: (query) => !sameKey(query.queryKey, deletedDetail),
    }),
    queryClient.invalidateQueries({
      queryKey: planKeys.all,
      predicate: (query) => !sameKey(query.queryKey, deletedSummary),
    }),
    queryClient.invalidateQueries({ queryKey: deletedDetail, exact: true, refetchType: 'none' }),
    queryClient.invalidateQueries({ queryKey: deletedSummary, exact: true, refetchType: 'none' }),
  ])
}

function sameKey(a: QueryKey, b: QueryKey): boolean {
  return a.length === b.length && a.every((part, index) => part === b[index])
}
