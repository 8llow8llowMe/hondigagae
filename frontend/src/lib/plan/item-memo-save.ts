import { messages } from '@/lib/messages'
import { setItemMemoPayload, visitsToRestore } from '@/lib/plan/item-memo-edit'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
import { fillTemplate } from '@/lib/text/template'
import type { PlanDayItemsReplacePayload, PlanDetail, PlanItemDetail } from '@/types/plan'

/**
 * 항목 메모 저장 한 번의 흐름 — 이슈 #1460 · `일정상세-세부명세.md` D30-3.
 *
 * **훅(`use-plan-item-memo.ts`)에서 뺐다.** 교체 → 상세 갈아끼우기 → `다녀옴` 되살리기 → 재조회의
 * 순서와 갈래가 이 기능의 전부인데, 훅은 node 환경에서 렌더되지 않는다(`testing-guide.md` §1).
 * 전송과 캐시는 `deps` 로 받아 테스트가 가짜를 꽂는다.
 */

export type ItemMemoSaveInput = {
  day: number
  /** 그 일자의 **현재 항목 전부**(순번대로). 되싣지 않으면 일자가 비워진다 */
  dayItems: PlanItemDetail[]
  planItemId: string
  /** 새 메모. `null` 이나 빈 값이면 지운다 */
  memo: string | null
}

export type ItemMemoSaveDeps = {
  replace: (payload: PlanDayItemsReplacePayload) => Promise<PlanDetail>
  markVisited: (planItemId: string) => Promise<void>
  /** 교체 응답을 캐시에 넣고 판정 등을 버린다. **여기서 던져도 저장 실패가 아니다** */
  onReplaced: (next: PlanDetail) => void
  /** 되살리기 뒤 상세 재조회. 호출부가 대기 상한을 건다. 되살릴 것이 없으면 부르지 않는다 */
  refetchDetail: () => Promise<void>
}

export type ItemMemoSaveResult =
  /** 들고 있는 상세에 그 항목이 없다 — 보내지 않았다 */
  | { kind: 'stale'; error: PlanDaySaveError }
  /** 교체가 실패했다 — 서버 상태는 그대로다 */
  | { kind: 'failed'; error: PlanDaySaveError }
  /** 저장됐다. `toast` 가 말할 문장이다 — 되살리기가 일부 실패하면 그 안내다 */
  | { kind: 'saved'; toast: string; restored: string[]; restoreFailed: boolean }

export async function runItemMemoSave(
  input: ItemMemoSaveInput,
  deps: ItemMemoSaveDeps,
): Promise<ItemMemoSaveResult> {
  const { day, dayItems, planItemId, memo } = input
  const target = dayItems.find((item) => item.planItemId === planItemId)
  const payload = setItemMemoPayload(dayItems, day, planItemId, memo)

  /*
    다른 탭에서 일정이 바뀌어 낡은 상세로 누른 것이다. 보내면 그 탭이 바꾼 일자를 옛 목록으로
    덮는다 — 새로고침을 안내한다 (시간 칩과 같은 결).
  */
  if (target === undefined || payload === null) {
    return { kind: 'stale', error: { message: messages.plan.saveStaleError, retriable: false } }
  }

  let next: PlanDetail
  try {
    next = await deps.replace(payload)
  } catch (cause) {
    return {
      kind: 'failed',
      error: toPlanDaySaveError(cause, {
        retriable: messages.plan.itemMemoErrorDescription,
        missingPlace: messages.plan.itemMemoMissingPlaceError,
      }),
    }
  }

  /*
    **여기부터는 저장이 끝난 뒤다** — 후처리에서 무엇이 던져도 "저장하지 못했어요" 로 말하지
    않는다 (`use-plan-add-move.ts` 의 2인자 `.then` 과 같은 이유).
  */
  try {
    deps.onReplaced(next)
  } catch {
    // 캐시 갈아끼우기 실패는 재조회가 메운다 — 저장은 됐다
  }

  const after = next.items
    .filter((item) => item.day === day)
    .sort((a, b) => a.sequence - b.sequence)
  const restored = visitsToRestore(dayItems, after)
  let restoreFailed = false

  if (restored.length > 0) {
    // 서로 다른 항목이라 겹쳐도 충돌하지 않는다 — 하나가 실패해도 나머지는 보낸다
    const results = await Promise.allSettled(restored.map((id) => deps.markVisited(id)))
    restoreFailed = results.some((result) => result.status === 'rejected')
    // 단건 응답이 `Response<Void>` 라 갈아끼울 상세가 없다 — 다시 받는다
    await deps.refetchDetail().catch(() => undefined)
  }

  const clearing = (memo ?? '').trim() === ''
  const toast = restoreFailed
    ? messages.plan.itemMemoVisitRestoreFailedToast
    : fillTemplate(
        clearing ? messages.plan.itemMemoClearedToast : messages.plan.itemMemoSavedToast,
        { title: target.title },
      )

  return { kind: 'saved', toast, restored, restoreFailed }
}
