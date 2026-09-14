import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import type { PackingListItem } from '@/types/ai-plan'
import {
  PACKING_LIMIT_EXCEEDED_CODE,
  PACKING_NAME_DUPLICATED_CODE,
  PACKING_SOURCE_USER_CODE,
  type PlanPackingDetailItem,
  type PlanPackingItemsSavePayload,
  type PlanPackingListResponse,
} from '@/types/plan'

/**
 * 여행 준비물 — **저장된 목록을 다루는 규칙의 유일한 소유자** (#586).
 *
 * 화면(`features/plan/plan-packing-list.tsx`)은 이 파일의 함수만 쓴다. 이 저장소의
 * 테스트는 jsdom 없이 `renderToStaticMarkup` 문자열로 검증하므로, 갈래 판정을 컴포넌트
 * 안에 두면 그 갈래를 훅 없이 재 볼 수 없다.
 */

/**
 * **AI 항목이 하나라도 저장돼 있는가.**
 *
 * `generatedAt` 이 그 답을 그대로 준다 — 서버 스키마가 *"AI 항목이 마지막으로 저장된
 * 시각. **AI 항목이 하나도 없으면 null**"* 이라고 못박는다. 그래서 이 값은 "한 번이라도
 * 만든 적 있는가" 가 **아니다**: AI 항목을 전부 지우면 다시 null 로 돌아간다.
 *
 * 화면이 이 값으로 가르는 것은 **"AI가 골랐어요" 라고 말해도 되는가** 다. 사용자가 직접
 * 적어 둔 항목만 있는 목록에 그 문장을 붙이면 거짓말이 된다.
 */
export function hasAiItems(list: PlanPackingListResponse): boolean {
  return list.generatedAt !== null
}

/**
 * **AI 생성을 권해도 되는 상태인가.** 서버가 적어 둔 흐름 그대로다 —
 * *"저장된 것이 없으면 … 그때 AI 준비물 생성을 부르고 그 결과를 저장 API 로 넣으세요.
 * items 가 있으면 LLM 을 다시 돌리지 않습니다."*
 *
 * **`items` 가 비었는지가 아니라 AI 항목이 있는지를 본다.** 직접 추가만 해 둔 목록은
 * 비어 있지 않지만 AI 를 아직 부른 적이 없어, 여기서 `items.length` 를 보면 그 사용자는
 * 생성 버튼을 영영 못 만난다.
 *
 * 목록을 아직 못 읽었으면(`null`) 권하지 않는다 — 저장된 것이 있는지 모르는 상태에서
 * 생성을 권하면 있는 것을 덮어쓸 수 있다.
 */
export function shouldOfferGeneration(list: PlanPackingListResponse | null): boolean {
  if (list === null) return false
  return !hasAiItems(list)
}

/**
 * AI 생성 결과 → 저장 요청 본문.
 *
 * **`reason` 이 빈 문자열이면 키를 뺀다.** 서버가 선택 필드로 열어 뒀고, 빈 문자열을
 * 보내면 이유가 **있는데 비어 있는** 항목이 저장돼 화면이 빈 줄을 그린다.
 *
 * 중복 이름·50개 초과는 **서버가 판정한다** — 같은 이름의 사용자 항목이 이미 있는지는
 * 화면이 알지만, 서버가 "보낸 목록 안의 중복은 첫 것만" 까지 함께 처리하므로 규칙을
 * 반쯤 복제하면 두 곳이 갈린다.
 */
export function toPackingSavePayload(items: PackingListItem[]): PlanPackingItemsSavePayload {
  return {
    items: items.map((item) => {
      const reason = item.reason.trim()
      return {
        category: item.category,
        name: item.name,
        ...(reason === '' ? {} : { reason }),
      }
    }),
  }
}

/**
 * 체크 상태를 바꾼 목록. **`checkedCount` 를 함께 고쳐 준다** — 두 값이 같은 응답에서
 * 오므로 한쪽만 고치면 요약 줄이 목록과 다른 수를 말한다.
 *
 * 챙김 체크는 `Response<Void>` 라 갱신된 목록이 오지 않는다. 그래서 화면이 낙관적으로
 * 먼저 그리고, 실패하면 이전 목록으로 되돌린다.
 */
export function withCheckedItem(
  list: PlanPackingListResponse,
  packingItemId: string,
  checked: boolean,
): PlanPackingListResponse {
  const items = list.items.map((item) =>
    item.packingItemId === packingItemId ? { ...item, checked } : item,
  )

  return { ...list, items, checkedCount: items.filter((item) => item.checked).length }
}

/**
 * 분류별로 묶는다. **서버 순서를 유지한다** — 처음 나온 분류가 먼저다.
 * 알파벳·가나다로 정렬하면 "필수" 가 "날씨 대비" 뒤로 밀린다.
 *
 * 서버가 `sortOrder` 오름차순으로 정렬해 주므로 **화면이 다시 정렬하지 않는다.**
 */
export function groupByCategory(
  items: PlanPackingDetailItem[],
): [string, PlanPackingDetailItem[]][] {
  const groups = new Map<string, PlanPackingDetailItem[]>()

  for (const item of items) {
    const group = groups.get(item.category)
    if (group === undefined) groups.set(item.category, [item])
    else group.push(item)
  }

  return [...groups.entries()]
}

/** 이미 쓰이고 있는 분류 — 직접 추가 폼이 "같은 이름이면 같은 묶음" 을 안내하는 데 쓴다 */
export function packingCategories(items: PlanPackingDetailItem[]): string[] {
  return groupByCategory(items).map(([category]) => category)
}

/** 사용자가 직접 적어 둔 항목인가. **이유가 비는 것이 실패가 아니라는 것**을 가른다 */
export function isUserPackingItem(item: PlanPackingDetailItem): boolean {
  return item.source.code === PACKING_SOURCE_USER_CODE
}

/** 직접 추가 폼의 값 */
export type PackingAddValues = {
  category: string
  name: string
}

/**
 * 직접 추가 폼 검증. 필드명 → 메시지.
 *
 * **길이 상한을 여기서 보지 않는다.** 서버가 `category` 30자 · `name` 100자로 막고,
 * 입력이 `maxLength` 로 이미 잘린다 — 두 곳에 같은 숫자를 적으면 한쪽만 고치는 날이 온다.
 * **중복 이름도 보지 않는다** — 서버가 대소문자·앞뒤 공백을 무시하고 판정하는데,
 * 그 규칙을 복제하면 화면이 서버보다 느슨하거나 빡빡해진다.
 */
export function validatePackingAdd(values: PackingAddValues): Record<string, string> {
  const errors: Record<string, string> = {}

  if (values.category.trim() === '') errors.category = messages.plan.errorPackingCategoryRequired
  if (values.name.trim() === '') errors.name = messages.plan.errorPackingNameRequired

  return errors
}

/** 폼 값 → `POST` 요청 본문 */
export function toPackingAddPayload(values: PackingAddValues): {
  category: string
  name: string
} {
  return { category: values.category.trim(), name: values.name.trim() }
}

/**
 * 직접 추가 실패 문구.
 *
 * **두 실패를 갈라 말한다.** 중복 이름(`PLAN_012`)은 다른 이름을 적으면 되고,
 * 50개 초과(`PLAN_013`)는 무엇을 적어도 안 된다 — 뭉뚱그리면 사용자가 이름만 바꿔 가며
 * 반복한다. 서버 문구를 그대로 쓰므로(복제본) 말투가 갈리지 않는다.
 */
export function packingAddErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return messages.plan.packingAddError

  if (error.resultCode === PACKING_NAME_DUPLICATED_CODE)
    return messages.plan.errorPackingNameDuplicated
  if (error.resultCode === PACKING_LIMIT_EXCEEDED_CODE)
    return messages.plan.errorPackingLimitExceeded

  return messages.plan.packingAddError
}
