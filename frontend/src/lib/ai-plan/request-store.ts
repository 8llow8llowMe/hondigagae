import type { AiPlanRequestSnapshot } from '@/types/ai-plan'

/**
 * 제출 조건 보관소 — 명세 S5 함정 1 · S8 미결 2.
 *
 * **초안에는 반려견·`areaCode`·기간·예산이 없는데 담기(`POST /plans`)에는 필요하다.**
 * 작업 조회 응답에도 요청 조건이 없어 **`jobId` 로는 되살릴 수 없다.** 그래서 제출할 때
 * `sessionStorage` 에 `jobId` 를 키로 저장하고 대기 화면이 읽는다.
 *
 * **URL 쿼리를 쓰지 않는 이유**: 주소가 길어지고 조건(반려견·예산)이 공유 링크에 새어
 * 나간다. **탭 단위로 사라지는 것이 맞다** — 다른 기기에서 같은 URL 을 열면 조건이
 * 실제로 없고, 그때 화면은 담기를 막고 조건을 다시 받는다.
 */

const KEY_PREFIX = 'hondigagae.ai-plan.request.'

function keyOf(jobId: string): string {
  return `${KEY_PREFIX}${jobId}`
}

/**
 * 저장 성공 여부. **실패해도 던지지 않는다** — 제출은 이미 접수됐고 조건 보관은
 * 부가 기능이다. 호출부는 false 를 보고 "담기 전에 조건을 다시 받아야 한다" 만 안다.
 *
 * 서버 렌더에는 `sessionStorage` 가 없고, 프라이버시 모드·사이트 데이터 차단에서는
 * 프로퍼티 접근만으로 던진다. 용량 초과(`QuotaExceededError`)도 같은 자리로 온다
 * (`src/lib/insight/recent-place.ts` 와 같은 방식).
 */
export function saveAiPlanRequest(jobId: string, snapshot: AiPlanRequestSnapshot): boolean {
  try {
    const store = globalThis.sessionStorage
    if (store === undefined) return false

    store.setItem(keyOf(jobId), JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}

/**
 * 저장한 조건. 없거나 모양이 어긋나면 null 이다.
 *
 * **모양을 검사한다.** 저장 형식을 바꾸면 이전 탭에 남은 값이 새 코드로 흘러들어
 * `POST /plans` 가 400 을 내는데, 원인이 코드가 아니라 열어 둔 탭에 있어 찾기 어렵다
 * (mock store 의 `isCurrentShape` 와 같은 판단).
 */
export function readAiPlanRequest(jobId: string): AiPlanRequestSnapshot | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(keyOf(jobId)) ?? null
    if (raw === null) return null

    return toSnapshot(JSON.parse(raw))
  } catch {
    // 접근 실패와 JSON 파싱 실패를 함께 받는다 — 둘 다 "조건이 없다" 로 귀결된다
    return null
  }
}

export function clearAiPlanRequest(jobId: string): void {
  try {
    globalThis.sessionStorage?.removeItem(keyOf(jobId))
  } catch {
    // 지우지 못해도 화면 흐름을 막지 않는다
  }
}

function toSnapshot(value: unknown): AiPlanRequestSnapshot | null {
  if (value === null || typeof value !== 'object') return null

  const record = value as Record<string, unknown>

  const areaCode = asNonEmptyString(record.areaCode)
  const startDate = asNonEmptyString(record.startDate)
  const endDate = asNonEmptyString(record.endDate)
  const pets = toPets(record)

  if (areaCode === null || startDate === null || endDate === null || pets.length === 0) return null

  const budget = record.budget
  if (budget !== null && typeof budget !== 'number') return null

  return {
    areaCode,
    startDate,
    endDate,
    pets,
    budget,
    requestNote: typeof record.requestNote === 'string' ? record.requestNote : '',
  }
}

/**
 * 반려견 목록. **옛 모양(`petId`·`petName`)을 한 마리 배열로 승격한다** (명세 D2-3).
 *
 * 승격이 없으면 배포 직후 대기 화면에 있던 사용자의 `readAiPlanRequest` 가 null 을 주고
 * **담기가 막힌다.** 승격은 읽기에서만 한다 — 쓰기는 항상 새 모양이라 양방향 호환을
 * 만들지 않는다(그러면 지울 시점이 사라진다).
 */
function toPets(record: Record<string, unknown>): { petId: string; name: string }[] {
  if (Array.isArray(record.pets)) {
    return record.pets.flatMap((entry) => {
      if (entry === null || typeof entry !== 'object') return []

      const item = entry as Record<string, unknown>
      const petId = asNonEmptyString(item.petId)
      if (petId === null) return []

      return [{ petId, name: typeof item.name === 'string' ? item.name : '' }]
    })
  }

  const legacyId = asNonEmptyString(record.petId)
  if (legacyId === null) return []

  return [{ petId: legacyId, name: typeof record.petName === 'string' ? record.petName : '' }]
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}
