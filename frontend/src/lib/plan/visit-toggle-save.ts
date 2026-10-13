import type { PlanDaySaveError } from '@/lib/plan/save-error'
import { toVisitToggleError } from '@/lib/plan/visit-error'
import type { PlanItemDetail } from '@/types/plan'

/**
 * `다녀옴` 토글 한 번의 흐름 — 이슈 #124 · #1489 · `일정상세-세부명세.md` D30-2.
 *
 * **훅(`use-plan-visit.ts`)에서 뺐다.** 훅은 이 약속이 끝날 때 그 행의 `pending` 을 풀고,
 * 메모 저장은 그 일자에 `pending` 이 있으면 잠긴다(`dayVisitPending`). 그래서 **이 약속이 상세
 * 재조회까지 기다리는 것**이 그 잠금의 전부다 — 훅은 node 환경에서 렌더되지 않아 여기서 잠근다.
 *
 * **재조회를 기다린다 (#1489).** PUT 만 기다리고 풀면, 재조회가 오기 전 캐시는 여전히
 * `visited=false` 다. 그 틈에 메모를 저장하면 일괄 교체가 그 캐시로 되싣고 `visitsToRestore` 도
 * 교체 전을 false 로 봐서, 방금 남긴 체크를 서버에서 지운다(해제 방향은 되살린다).
 *
 * **대기 상한을 두지 않는다** — 시각 · 메모 저장(`DETAIL_REFETCH_WAIT_MS`)과 갈리는 지점이다.
 * 그쪽은 모달이라 상한이 없으면 닫을 길이 없어지지만, 여기서 잠기는 것은 그 행의 토글과 그 일자의
 * 메모 저장뿐이다. 상한을 두면 늦은 재조회에서 같은 틈이 다시 열린다.
 */
export type VisitToggleDeps = {
  /** `PUT …/items/{planItemId}/visited` */
  mark: () => Promise<void>
  /** 판정 · 브리핑 무효화 같은 기다리지 않는 후처리. **여기서 던져도 저장 실패가 아니다** */
  afterMarked: () => void
  /** 상세 재조회. 응답이 `Response<Void>` 라 이것이 유일한 갱신 경로다 */
  refetchDetail: () => Promise<void>
}

export type VisitToggleResult = { kind: 'saved' } | { kind: 'failed'; error: PlanDaySaveError }

export async function runVisitToggle(deps: VisitToggleDeps): Promise<VisitToggleResult> {
  try {
    await deps.mark()
  } catch (cause) {
    return { kind: 'failed', error: toVisitToggleError(cause) }
  }

  // 여기부터는 저장이 끝난 뒤다 — 후처리 · 재조회 실패를 저장 실패로 말하지 않는다
  try {
    deps.afterMarked()
  } catch {
    // 재조회가 메운다
  }
  /*
    재조회가 끝내 실패하면 캐시가 낡은 채 잠금이 풀린다 — 남는 틈이다. 실패한 상세 조회는 화면이
    오류 상태로 그리고, 다음 재조회가 메운다.
  */
  await deps.refetchDetail().catch(() => undefined)

  return { kind: 'saved' }
}

/** 그 일자 항목 중 `다녀옴` 토글이 진행 중인(PUT → 재조회) 것이 있는가 — 메모 저장 잠금 */
export function dayVisitPending(items: PlanItemDetail[], pending: ReadonlySet<string>): boolean {
  return items.some((item) => pending.has(item.planItemId))
}
