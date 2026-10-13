import { messages } from '@/lib/messages'
import { toPayloadItem } from '@/lib/plan/day-items'
import type { PlanDayItemsReplacePayload, PlanItemDetail } from '@/types/plan'

/**
 * 일정 상세 항목 메모 고치기 · 지우기의 순수 로직 — 이슈 #1460 · `일정상세-세부명세.md` D30.
 *
 * **항목 단건 수정 API 가 없다.** 항목 단위로 고칠 수 있는 것은 `visited` · `startTime` 뿐이라
 * 메모는 일자 일괄 교체(`PUT …/days/{day}/items`)에 실어 바꾼다. 그래서 여기 규칙은 전부
 * **"다른 것을 잃지 않는다"** 이다 — 그 일자의 다른 항목 · 같은 항목의 다른 필드를 원문 그대로
 * 되싣고(`toPayloadItem`), 교체가 풀어 버리는 `다녀옴` 은 응답을 받은 뒤 되살린다.
 */

/** 백엔드 `PlanItemRequest.memo` 의 `@Size(max = 500)` (`docs/api/openapi/plan-service.json`) */
export const ITEM_MEMO_MAX = 500

function normalizedMemo(value: string | null): string {
  return (value ?? '').trim()
}

/**
 * 메모 검증. 통과하면 `null`, 아니면 필드에 붙일 문구.
 *
 * **빈 값은 막지 않는다** — 비워서 저장하는 것이 지우기다. 길이는 **걷어낸 값으로** 잰다 —
 * 보내는 것이 걷어낸 값이다(`setItemMemoPayload`). `validateMoveTitle` 과 같은 판단이다.
 */
export function validateItemMemo(value: string): string | null {
  if (normalizedMemo(value).length > ITEM_MEMO_MAX) return messages.plan.itemMemoTooLong
  return null
}

/**
 * 저장할 것이 있는가. **걷어낸 값으로 견준다** — `null` 과 빈 값 · 공백뿐도 같다.
 *
 * 같은 값이면 보내지 않는다. 일괄 교체는 그 일자의 `planItemId` 를 전부 새로 발급하고
 * `다녀옴` 을 풀어 되살리는 요청까지 낳는다 — 얻는 것 없이 치를 값이 크다.
 */
export function itemMemoChanged(original: string | null, next: string): boolean {
  return normalizedMemo(original) !== normalizedMemo(next)
}

/**
 * 그 일자에서 **항목 하나의 메모만** 바꾼 일괄 교체 본문. 들고 있는 상세에 그 항목이 없으면
 * `null` — 다른 탭에서 일정이 바뀐 것이라 보내지 않는다.
 *
 * - **다른 항목 · 같은 항목의 다른 필드는 `toPayloadItem` 으로 원문 그대로 되싣는다** —
 *   `itemType` · `targetId`(문자열) · `title` · `startTime` · 다른 항목의 `memo` (E1)
 * - **순서를 바꾸지 않는다.** `sequence` 는 화면 순서(상세가 정렬해 준 배열) 그대로 0부터다
 * - `memo` 는 앞뒤 공백을 걷는다. **비거나 `null` 이면 키를 뺀다** — 계약이 "생략하면 비워
 *   둡니다" 이고, 되싣는 쪽(`toPayloadItem`)도 없는 메모는 키를 빼므로 한 본문에 두 모양을
 *   섞지 않는다
 *
 * **`다녀옴` 은 본문에 실을 수 없다** — 요청 DTO 에 필드가 없고 교체가 새 항목을 `false` 로
 * 만든다. 되살리기는 `visitsToRestore` 가 응답을 받은 뒤에 가른다.
 */
export function setItemMemoPayload(
  items: PlanItemDetail[],
  day: number,
  planItemId: string,
  memo: string | null,
): PlanDayItemsReplacePayload | null {
  if (!items.some((item) => item.planItemId === planItemId)) return null

  const next = normalizedMemo(memo)

  return {
    items: items.map((item, index) =>
      toPayloadItem(
        item.planItemId === planItemId ? { ...item, memo: next === '' ? null : next } : item,
        day,
        index,
      ),
    ),
  }
}

/**
 * 교체 뒤 **다시 `다녀옴` 으로 표시할 새 `planItemId`** 들.
 *
 * 교체 전 그 자리(같은 순번)가 `다녀옴` 이었고 교체 뒤에는 풀린 항목이다. **자리의 항목이
 * 같은지 `itemType` · `targetId` · `title` 로 확인한다** — 그 사이 다른 탭이 그 일자를 바꿨으면
 * 같은 순번에 다른 항목이 서 있을 수 있고, 남의 행에 체크를 남기는 것이 체크를 잃는 것보다
 * 나쁘다. **항목 수가 다르면 아무것도 되살리지 않는다** — 자리 맞대기 자체가 성립하지 않는다.
 *
 * `before` · `after` 는 둘 다 **그 일자의 항목을 순번대로** 담은 배열이다.
 */
export function visitsToRestore(before: PlanItemDetail[], after: PlanItemDetail[]): string[] {
  if (before.length !== after.length) return []

  const ids: string[] = []
  before.forEach((previous, index) => {
    const current = after[index]
    if (current === undefined || !previous.visited || current.visited) return
    if (
      current.itemType.code !== previous.itemType.code ||
      current.targetId !== previous.targetId ||
      current.title !== previous.title
    ) {
      return
    }
    ids.push(current.planItemId)
  })

  return ids
}

/**
 * 메모 모달이 가리키는 항목의 **연 시점 스냅숏** (#1460 리뷰).
 *
 * **모달을 지금 상세에서 찾아 열지 않는다.** 저장은 일괄 교체라 응답이 캐시에 들어가는 순간 그
 * 일자의 `planItemId` 가 전부 바뀐다 — 지금 상세에서 찾으면 모달이 되살리기 · 재조회 도중에
 * 언마운트돼 초점이 `body` 로 떨어지고 잠금 없는 틈이 생긴다. 열 때 제목 · 메모 · 자리를 적어
 * 두고 `onSaved`(또는 닫기)까지 이것으로 그린다.
 */
export type ItemMemoTarget = {
  day: number
  /** 연 시점의 id — 저장 본문은 지금 상세에서 이 id 를 찾는다(없으면 stale) */
  planItemId: string
  /** 그 일자 안 순번. 저장 뒤 초점을 돌려줄 자리다 — 메모 저장은 순서를 바꾸지 않는다 */
  index: number
  title: string
  memo: string | null
}

export function itemMemoTargetOf(
  day: number,
  items: PlanItemDetail[],
  planItemId: string,
): ItemMemoTarget | null {
  const index = items.findIndex((item) => item.planItemId === planItemId)
  const item = items[index]
  if (item === undefined) return null

  return { day, planItemId, index, title: item.title, memo: item.memo }
}

/** 모달이 그릴 것 — **스냅숏만 본다.** 상세가 바뀌어도 닫히지 않는다 */
export function itemMemoModalProps(target: ItemMemoTarget | null): {
  open: boolean
  key: string
  title: string
  initial: string | null
} {
  if (target === null) return { open: false, key: 'closed', title: '', initial: null }

  return { open: true, key: target.planItemId, title: target.title, initial: target.memo }
}
