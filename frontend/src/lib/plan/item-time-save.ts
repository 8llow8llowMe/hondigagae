import { toItemStartTimeError } from '@/lib/plan/item-time-error'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 항목 시각 저장 한 번의 흐름 — 이슈 #1053 · #1501 · `일정상세-세부명세.md` D30-2.
 *
 * **훅(`use-plan-item-time.ts`)에서 뺐다.** 훅은 node 환경에서 렌더되지 않아 여기서 흐름을 잠근다.
 *
 * **끝나는 시점이 둘이다 (#1501).**
 * - 결과(`Promise<ItemTimeSaveResult>`)는 **모달을 닫는 시점**이다 — 재조회와 대기 상한
 *   (`waitCap`) 중 먼저 오는 쪽. 상한이 없으면 재조회가 5xx 재시도 · 오프라인으로 늘어질 때 저장은
 *   됐는데 모달을 닫을 길이 없어진다.
 * - `refetched` 는 **재조회 자체가 끝나는 시점**이다. 상한에서 모달이 닫혀도 캐시는 아직 옛
 *   `startTime` 이라, 그 틈에 일괄 교체(메모 · 담기 · 이동 추가 · 순서 편집)가 나가면 그 캐시로
 *   되실어 서버의 새 시각을 덮는다. 훅은 이것이 끝날 때까지 그 일자를 잠금에 둔다(`dayItemsSaveLocks`).
 *   `다녀옴` 토글(`runVisitToggle`, #1489)이 재조회까지 잠그는 것과 같은 결이다.
 */
export type ItemTimeSaveDeps = {
  /** `PUT …/items/{planItemId}/start-time` */
  change: () => Promise<void>
  /** 판정 · 브리핑 무효화 같은 기다리지 않는 후처리. **여기서 던져도 저장 실패가 아니다** */
  afterChanged: () => void
  /** 상세 재조회. 응답이 `Response<Void>` 라 이것이 유일한 갱신 경로다 */
  refetchDetail: () => Promise<void>
  /** 모달을 닫기까지 재조회를 기다리는 상한 */
  waitCap: () => Promise<void>
}

export type ItemTimeSaveResult =
  /** 저장됐다. `refetched` 는 재조회가 끝나면(실패해도) 풀린다 — 거부되지 않는다 */
  { kind: 'saved'; refetched: Promise<void> } | { kind: 'failed'; error: PlanDaySaveError }

export async function runItemTimeSave(deps: ItemTimeSaveDeps): Promise<ItemTimeSaveResult> {
  try {
    await deps.change()
  } catch (cause) {
    return { kind: 'failed', error: toItemStartTimeError(cause) }
  }

  // 여기부터는 저장이 끝난 뒤다 — 후처리 · 재조회 실패를 저장 실패로 말하지 않는다
  try {
    deps.afterChanged()
  } catch {
    // 재조회가 메운다
  }

  /*
    재조회가 끝내 실패하면 낡은 캐시로 잠금이 풀린다 — 남는 틈이다(`runVisitToggle` 과 같다).
    실패한 상세 조회는 화면이 오류 상태로 그리고, 다음 재조회가 메운다.
  */
  const refetched = deps.refetchDetail().catch(() => undefined)
  await Promise.race([refetched, deps.waitCap()])

  return { kind: 'saved', refetched }
}
