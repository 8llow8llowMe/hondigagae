# AI 일정 하루 재생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 저장된 일정의 하루만 AI 로 다시 짜고, 그 결과를 확인한 뒤 그 일자에 되붙인다.

**Architecture:** 새 라우트 `/plans/[planId]/days/[day]/regenerate` 하나가 세 상태(제출 → 대기 → 비교)를 갖는다. `jobId` 는 쿼리스트링에 두어 새로고침에 견딘다. 제출은 기존 `POST /ai-plans` 에 `planId` + `regenerateDay` 를 실어 보내고, 대기는 이미 있는 `useAiPlanJob`(SSE + 폴링 안전망)을 그대로 쓴다. 완료되면 초안이 **모든 날**을 담아 오지만 **목표 일자 하나만** 뽑아 `PUT /plans/{id}/days/{day}/items` 로 교체한다.

**Tech Stack:** Next.js App Router (16, Turbopack) · React 19 · TanStack Query · Tailwind · vitest (node 환경 + `renderToStaticMarkup` 문자열 assertion, jsdom 없음)

**Spec:** `frontend/docs/features/ai-plan/하루재생성-세부명세.md`

## Global Constraints

모든 작업의 요구사항에 아래가 암묵적으로 포함된다.

- **모든 파일은 UTF-8 (no BOM).** `.editorconfig` · `.gitattributes` 를 덮어쓰지 않는다.
- **작업 디렉터리는 `frontend/` 다.** 아래 모든 경로와 명령은 `frontend/` 기준이다.
- **백엔드를 브라우저에서 직접 부르지 않는다.** 전부 `/api/bff` 경유 (`clientFetch`).
- **비동기 AI 작업 실패는 HTTP 200 + `status.code === 'FAILED'`** 다. `dataHeader.success` 만 보면 놓친다.
- **ID 는 `string`** 이다. Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다.
- **서버 enum metadata(`{code,name,description}`)를 그대로 렌더한다.** 한국어 매핑 테이블을 만들지 않는다.
- **컴포넌트 `className` 으로 외형(색·radius·shadow·padding)을 덮지 않는다.** 레이아웃 유틸리티만.
- 문구 어미는 **해요체** (`DESIGN.md` §1).
- 커밋 제목은 `[FE] <type>: <요약>` (`feat`/`fix`/`chore`/`refactor`/`style`/`docs`/`test`).
- 검증 명령은 `pnpm verify` (= `lint && typecheck && test`) 와 `pnpm format:check` 다.
- 브랜치는 `feature/fe/128-day-regenerate` 하나를 쓰고 태스크마다 커밋한다.

## File Structure

**새로 만드는 것**

| 파일 | 책임 |
| --- | --- |
| `src/lib/ai-plan/regenerate.ts` | 순수 로직 둘 — 일정 → 제출 payload, 초안 → **그 일자** 항목 |
| `src/lib/ai-plan/regenerate.test.ts` | 위 둘의 테스트 |
| `src/features/plan/plan-day-diff.tsx` | 지금 / 바뀌는 모습 나란히 |
| `src/features/plan/plan-day-diff.test.ts` | 비교 렌더 분기 |
| `src/features/plan/plan-day-regenerate-confirm.tsx` | 확정 전 경고 두 줄 + 확정 버튼 (순수 컴포넌트) |
| `src/features/plan/plan-day-regenerate-confirm.test.ts` | 경고 문구가 버튼 앞에 있는지 |
| `src/features/plan/plan-day-regenerate-view.tsx` | 세 상태 조립 (제출 · 대기 · 비교) |
| `src/features/plan/plan-day-regenerate.test.ts` | 뷰 렌더 분기 |
| `app/(main)/plans/[planId]/days/[day]/regenerate/page.tsx` | 라우트 · 프리페치 · 404 |

**고치는 것**

| 파일 | 무엇 |
| --- | --- |
| `src/types/ai-plan.ts` | `AiPlanSubmitPayload` 에 `planId` · `regenerateDay` |
| `src/lib/ai-plan/submit.ts` | 주석의 "아직 보내지 않는다" 를 "이 경로는 보내지 않는다" 로 |
| `src/lib/ai-plan/submit.test.ts` | 잠금 테스트의 **뜻을 바꾼다** (지우지 않는다) |
| `src/lib/ai-plan/draft-to-plan.ts` | 내부 `toItems` 를 `toDraftItems` 로 **export** — 매핑 규칙을 나눠 쓴다 |
| `src/lib/messages/plan.ts` | 이 화면 문구 |
| `src/features/plan/plan-day-section.tsx` | 일자 헤더에 `다시 만들기` |
| `src/features/plan/plan-detail-section.tsx` | 위로 `regenerateHref` 전달 |
| `src/lib/api/mock/ai-plan-data.ts` | 재생성 갈래 |
| `frontend/docs/features/ai-plan/공통명세.md` | S2 화면 범위 |
| `frontend/docs/screen-inventory.md` | 라우트 |

---

### Task 1: 제출 계약에 두 필드를 연다

**Files:**

- Modify: `src/types/ai-plan.ts` (`AiPlanSubmitPayload`)
- Modify: `src/lib/ai-plan/submit.ts:29` (주석 한 줄)
- Test: `src/lib/ai-plan/submit.test.ts:132`

**Interfaces:**

- Consumes: 없음 (첫 태스크)
- Produces: `AiPlanSubmitPayload` 에 `planId?: string` · `regenerateDay?: number`. Task 2 가 이 두 키를 채운다.

- [ ] **Step 1: 잠금 테스트의 뜻을 바꿔 실패시킨다**

`src/lib/ai-plan/submit.test.ts` 의 기존 테스트(132행)를 **지우지 말고** 아래로 바꾼다.

```ts
  /*
    #128 로 두 필드가 타입에 열렸다. **생성 경로에서는 여전히 안 실린다** — 이 함수는
    새 일정을 만드는 폼의 것이고, 하루 재생성은 `lib/ai-plan/regenerate.ts` 가 따로
    만든다 (하루재생성-세부명세 R3). 이 잠금을 없애면 생성 요청에 두 필드가 새어 드는
    회귀를 아무도 막지 않게 된다.
  */
  it('생성 경로에는 planId·regenerateDay 가 실리지 않는다 (#128)', () => {
    const payload = toAiPlanSubmitPayload(
      values({ preferFavorites: true, pinnedPlaces: [{ placeId: '1', title: '가' }] }),
    )

    expect('planId' in payload).toBe(false)
    expect('regenerateDay' in payload).toBe(false)

    // 타입에는 열려 있다 — 재생성 경로가 쓴다
    const withRegenerate: AiPlanSubmitPayload = { ...payload, planId: '1', regenerateDay: 2 }
    expect(withRegenerate.regenerateDay).toBe(2)
  })
```

같은 파일 맨 위 import 에 타입을 더한다.

```ts
import type { AiPlanSubmitPayload } from '@/types/ai-plan'
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/ai-plan/submit.test.ts`
Expected: FAIL — `Object literal may only specify known properties, and 'planId' does not exist in type 'AiPlanSubmitPayload'` (타입 오류로 죽는다)

- [ ] **Step 3: 타입을 연다**

`src/types/ai-plan.ts` 의 `AiPlanSubmitPayload` 마지막 필드(`pinnedPlaceIds?`) **뒤에** 더한다.

```ts
  /**
   * 하루 재생성 대상 일정 (#128 · 하루재생성-세부명세 R3).
   *
   * **`regenerateDay` 와 반드시 짝이다** — 하나만 오면 서버가 막는다
   * (`AiPlanJobProcessor:191`). 새 일정을 만드는 경로(`/ai-plans/new`)는 둘 다
   * 보내지 않는다.
   *
   * Snowflake 라 **문자열 그대로 보낸다** — `Number()` 를 거치면 정밀도를 잃는다.
   */
  planId?: string
  /** 다시 구성할 일차, **1부터**. `planId` 와 반드시 짝이다 (`@Positive`) */
  regenerateDay?: number
```

- [ ] **Step 4: 주석을 사실에 맞춘다**

`src/lib/ai-plan/submit.ts:29` 의 줄을 바꾼다.

```ts
 * - **`planId`·`regenerateDay` 는 이 함수가 보내지 않는다.** 여기는 새 일정을 만드는
 *   경로다. 하루 재생성은 `lib/ai-plan/regenerate.ts` 가 따로 만든다
 *   (하루재생성-세부명세 R3)
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/ai-plan/submit.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/types/ai-plan.ts src/lib/ai-plan/submit.ts src/lib/ai-plan/submit.test.ts
git commit -m "[FE] feat: AI 제출 payload 에 planId·regenerateDay 를 연다"
```

---

### Task 2: 일정 → 제출 payload

**Files:**

- Create: `src/lib/ai-plan/regenerate.ts`
- Test: `src/lib/ai-plan/regenerate.test.ts`

**Interfaces:**

- Consumes: Task 1 의 `AiPlanSubmitPayload` (`planId` · `regenerateDay`)
- Produces: `toDayRegeneratePayload(plan: PlanDetail, day: number, requestNote: string): AiPlanSubmitPayload`. Task 7 이 제출할 때 부른다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/ai-plan/regenerate.test.ts` 를 만든다.

```ts
import { describe, expect, it } from 'vitest'

import { toDayRegeneratePayload } from '@/lib/ai-plan/regenerate'
import type { PlanDetail } from '@/types/plan'

function plan(overrides: Partial<PlanDetail> = {}): PlanDetail {
  return {
    planId: '223456789012000001',
    petId: '123456789012000001',
    petIds: ['123456789012000001', '123456789012000002'],
    areaCode: '39',
    sigunguCode: '4',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    budget: 400000,
    status: { code: 'DRAFT', name: '초안', description: null },
    totalDays: 3,
    items: [],
    ...overrides,
  }
}

describe('toDayRegeneratePayload', () => {
  it('일정에서 지역·기간·반려견을 그대로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan(), 2, '')

    expect(payload.areaCode).toBe('39')
    expect(payload.startDate).toBe('2026-09-12')
    expect(payload.endDate).toBe('2026-09-14')
    expect(payload.petIds).toEqual(['123456789012000001', '123456789012000002'])
  })

  it('planId 와 regenerateDay 를 짝으로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan(), 2, '')

    expect(payload.planId).toBe('223456789012000001')
    expect(payload.regenerateDay).toBe(2)
  })

  /*
    Snowflake 다. `Number()` 를 거치면 정밀도를 잃는다 — `submit.ts` 의 pinnedPlaceIds 와
    같은 판단이다.
  */
  it('planId 를 숫자로 바꾸지 않는다', () => {
    expect(typeof toDayRegeneratePayload(plan(), 1, '').planId).toBe('string')
  })

  it('예산이 없으면 키 자체를 넣지 않는다 — @Positive 다', () => {
    expect('budget' in toDayRegeneratePayload(plan({ budget: null }), 1, '')).toBe(false)
  })

  it('예산이 0 이하면 키를 넣지 않는다', () => {
    expect('budget' in toDayRegeneratePayload(plan({ budget: 0 }), 1, '')).toBe(false)
  })

  it('예산이 있으면 원 단위 그대로 싣는다', () => {
    expect(toDayRegeneratePayload(plan(), 1, '').budget).toBe(400000)
  })

  it('메모가 비면 키를 넣지 않는다', () => {
    expect('requestNote' in toDayRegeneratePayload(plan(), 1, '   ')).toBe(false)
  })

  it('메모는 trim 해서 싣는다', () => {
    expect(toDayRegeneratePayload(plan(), 1, '  실내 위주로  ').requestNote).toBe('실내 위주로')
  })

  /*
    R3-1. 일정에 저장되지 않는 값이라 되살릴 근거가 없다. 특히 pinnedPlaceIds 는
    "반드시 배치" 약속이라 잘못 실으면 요구한 적 없는 장소가 그 날에 박힌다.
  */
  it('preferFavorites·pinnedPlaceIds 를 지어내지 않는다', () => {
    const payload = toDayRegeneratePayload(plan(), 1, '메모')

    expect('preferFavorites' in payload).toBe(false)
    expect('pinnedPlaceIds' in payload).toBe(false)
  })

  it('한 마리 일정도 petIds 원소 하나로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan({ petIds: ['123456789012000001'] }), 1, '')

    expect(payload.petIds).toEqual(['123456789012000001'])
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/ai-plan/regenerate.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ai-plan/regenerate"`

- [ ] **Step 3: 최소 구현**

`src/lib/ai-plan/regenerate.ts` 를 만든다.

```ts
import type { AiPlanSubmitPayload } from '@/types/ai-plan'
import type { PlanDetail } from '@/types/plan'

/**
 * 하루 재생성 (#128 · 하루재생성-세부명세).
 *
 * **새 API 를 만들지 않는다.** 생성과 같은 `POST /ai-plans` 에 `planId` + `regenerateDay`
 * 를 실으면 서버가 기존 일정 개요를 불러 그 날만 새로 짠다
 * (`AiPlanPromptFactory#appendRegenerateSection`).
 */

/**
 * 저장된 일정 → 재생성 제출 본문 (R3).
 *
 * **조건이 전부 일정에서 나온다.** 그래서 생성 경로와 달리 `sessionStorage` 스냅샷을
 * 쓰지 않는다 (R2-2) — 보관할 것이 없다.
 *
 * **`preferFavorites`·`pinnedPlaceIds` 를 싣지 않는다** (R3-1). 일정에 저장되지 않는
 * 값이라 되살릴 근거가 없고, `pinnedPlaceIds` 는 "반드시 배치" 약속이라 잘못 실으면
 * 사용자가 요구한 적 없는 장소가 그 날에 박힌다.
 *
 * @param day 1부터. 호출부가 `plan.totalDays` 안인지 이미 확인했다
 * @param requestNote 화면 입력. 길이는 textarea 의 `maxLength` 가 막는다 —
 *   `toAiPlanSubmitPayload` 와 같은 분담이라 여기서 자르지 않는다
 */
export function toDayRegeneratePayload(
  plan: PlanDetail,
  day: number,
  requestNote: string,
): AiPlanSubmitPayload {
  const note = requestNote.trim()
  // `@Positive` — 0 을 보내면 요청 전체가 400 이다
  const budget = plan.budget !== null && plan.budget > 0 ? plan.budget : null

  return {
    areaCode: plan.areaCode,
    startDate: plan.startDate,
    endDate: plan.endDate,
    petIds: plan.petIds,
    ...(budget === null ? {} : { budget }),
    ...(note === '' ? {} : { requestNote: note }),
    planId: plan.planId,
    regenerateDay: day,
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/ai-plan/regenerate.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ai-plan/regenerate.ts src/lib/ai-plan/regenerate.test.ts
git commit -m "[FE] feat: 저장된 일정에서 하루 재생성 제출 본문을 만든다"
```

---

### Task 3: 초안 → 그 일자 항목

**Files:**

- Modify: `src/lib/ai-plan/draft-to-plan.ts` (내부 `toItems` 를 export)
- Modify: `src/lib/ai-plan/regenerate.ts`
- Test: `src/lib/ai-plan/regenerate.test.ts`

**Interfaces:**

- Consumes: Task 2 의 `regenerate.ts`
- Produces:
  - `toDraftItems(draft: AiPlanDraft, totalDays: number | null, excludedPlaceIds?: ReadonlySet<string>): PlanItemRequest[]` (`draft-to-plan.ts` 에서 export)
  - `toRegeneratedDayItems(draft: AiPlanDraft, day: number, totalDays: number, excludedPlaceIds?: ReadonlySet<string>): PlanItemRequest[] | null` — Task 6·7 이 쓴다. **`null` 은 "그 날을 못 만들었다" 이고 빈 배열과 뜻이 다르다.**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/ai-plan/regenerate.test.ts` 맨 아래에 더한다. import 도 함께 늘린다.

```ts
import { toDayRegeneratePayload, toRegeneratedDayItems } from '@/lib/ai-plan/regenerate'
import type { AiPlanDraft } from '@/types/ai-plan'
```

```ts
function draft(): AiPlanDraft {
  return {
    days: [
      {
        day: 1,
        items: [
          { itemType: 'PLACE', placeId: '111', title: '1일차 그대로', note: null },
        ],
      },
      {
        day: 2,
        items: [
          { itemType: 'PLACE', placeId: '222', title: '오설록 티뮤지엄', note: '실내예요' },
          { itemType: 'WALK', placeId: '333', title: '사려니숲길 산책', note: null },
        ],
      },
    ],
    reasons: [],
  }
}

describe('toRegeneratedDayItems', () => {
  /*
    R4. 프롬프트가 "나머지 날은 그대로 유지해 전체 일정을 출력할 것" 이라고 **부탁**할
    뿐 강제하지 않는다. 사용자는 하루만 바꾸겠다고 했다.
  */
  it('목표 일자만 뽑는다 — 다른 날은 무시한다', () => {
    const items = toRegeneratedDayItems(draft(), 2, 3)

    expect(items).not.toBeNull()
    expect(items?.every((item) => item.day === 2)).toBe(true)
    expect(items?.map((item) => item.title)).toEqual(['오설록 티뮤지엄', '사려니숲길 산책'])
  })

  it('sequence 를 0부터 다시 매긴다', () => {
    expect(toRegeneratedDayItems(draft(), 2, 3)?.map((item) => item.sequence)).toEqual([0, 1])
  })

  /*
    R4-3 · #89. `AiPlanScheduleItem.placeId` 는 장소 id 인데 `WALK` 의 `targetId` 는
    `walk_course.id` 다. 보내면 틀린 id 가 조용히 저장된다.
  */
  it('WALK 에는 targetId 를 붙이지 않는다', () => {
    const items = toRegeneratedDayItems(draft(), 2, 3)
    const walk = items?.find((item) => item.itemType === 'WALK')

    expect(walk).toBeDefined()
    expect('targetId' in (walk ?? {})).toBe(false)
  })

  it('PLACE 에는 targetId 를 붙인다', () => {
    const place = toRegeneratedDayItems(draft(), 2, 3)?.find((item) => item.itemType === 'PLACE')

    expect(place?.targetId).toBe('222')
  })

  /*
    R4-2. 빈 배열로 PUT 하면 `PlanDayItemsReplacePayload` 가 "그 일자 전부 삭제" 로
    읽는다 — 재생성 실패가 조용한 삭제가 된다.
  */
  it('목표 일자가 없으면 null 이다 — 빈 배열이 아니다', () => {
    expect(toRegeneratedDayItems(draft(), 3, 3)).toBeNull()
  })

  it('목표 일자의 항목이 전부 걸러지면 빈 배열이다 — null 과 다르다', () => {
    const empty: AiPlanDraft = {
      days: [{ day: 2, items: [{ itemType: 'PLACE', placeId: null, title: '  ', note: null }] }],
      reasons: [],
    }

    expect(toRegeneratedDayItems(empty, 2, 3)).toEqual([])
  })

  it('title 이 null 인 항목을 만나도 죽지 않는다', () => {
    const nullTitle: AiPlanDraft = {
      days: [{ day: 2, items: [{ itemType: 'PLACE', placeId: '1', title: null, note: null }] }],
      reasons: [],
    }

    expect(toRegeneratedDayItems(nullTitle, 2, 3)).toEqual([])
  })

  it('제외한 장소는 빠진다 — PLAN_004 재시도가 쓴다', () => {
    const items = toRegeneratedDayItems(draft(), 2, 3, new Set(['222']))

    expect(items?.map((item) => item.title)).toEqual(['사려니숲길 산책'])
  })

  it('기간 밖 일차는 애초에 뽑히지 않는다', () => {
    expect(toRegeneratedDayItems(draft(), 2, 1)).toEqual([])
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/ai-plan/regenerate.test.ts`
Expected: FAIL — `toRegeneratedDayItems is not a function`

- [ ] **Step 3: 매핑 규칙을 export 한다**

`src/lib/ai-plan/draft-to-plan.ts` 의 `function toItems(` 를 아래로 바꾼다. **본문은 그대로 두고 이름과 export 만 바꾼다.**

```ts
/**
 * 초안 → 항목 목록. **담기(`POST /plans`)와 하루 재생성(`PUT .../days/{day}/items`)이
 * 나눠 쓴다** (하루재생성-세부명세 R4-3) — 규칙이 두 벌이 되면 반드시 갈라진다.
 */
export function toDraftItems(
  draft: AiPlanDraft,
  totalDays: number | null,
  excludedPlaceIds?: ReadonlySet<string>,
): PlanItemRequest[] {
```

같은 파일 안의 호출부(`items: toItems(draft, totalDays ?? null, excludedPlaceIds)`)를 `toDraftItems` 로 바꾼다.

- [ ] **Step 4: `regenerate.ts` 에 함수를 더한다**

```ts
import { toDraftItems } from '@/lib/ai-plan/draft-to-plan'
import type { AiPlanDraft, AiPlanSubmitPayload } from '@/types/ai-plan'
import type { PlanDetail, PlanItemRequest } from '@/types/plan'
```

```ts
/**
 * 재생성 초안에서 **그 일자 하나만** 뽑는다 (R4).
 *
 * **초안은 모든 날을 담아 온다.** 프롬프트가 _"나머지 날은 기존 항목을 순서까지 그대로
 * 유지해 전체 일정을 출력할 것"_ 이라고 지시하기 때문이다. 그 지시는 **부탁이지 강제가
 * 아니다** — 이 저장소는 이미 LLM 산출물을 못 믿는 전제로 짜여 있다
 * (`draft-to-plan.ts` 가 기간 밖 일차를 걸러내는 것과 같은 판단).
 *
 * 다른 날을 반영하지 않는 이유는 둘이다. **사용자가 하루만 바꾸겠다고 말했고**,
 * 일자별 PUT 은 원자적이지 않아 여러 날을 쓰다 중간에 실패하면 반쯤 바뀐 일정이 남는다.
 *
 * @returns 목표 일자가 초안에 없으면 `null`. **빈 배열과 뜻이 다르다** —
 *   `PlanDayItemsReplacePayload` 는 빈 목록을 "그 일자 전부 삭제" 로 읽으므로
 *   재생성 실패를 조용한 삭제로 바꾸면 안 된다 (R4-2)
 */
export function toRegeneratedDayItems(
  draft: AiPlanDraft,
  day: number,
  totalDays: number,
  excludedPlaceIds?: ReadonlySet<string>,
): PlanItemRequest[] | null {
  const target = draft.days.find((entry) => entry.day === day)
  if (target === undefined) return null

  return toDraftItems({ days: [target], reasons: [] }, totalDays, excludedPlaceIds)
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/ai-plan/regenerate.test.ts src/lib/ai-plan/draft-to-plan.test.ts`
Expected: PASS — 두 파일 모두. `draft-to-plan.test.ts` 는 손대지 않았고 이름만 바뀐 함수를 내부에서 쓰므로 그대로 통과해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/ai-plan/regenerate.ts src/lib/ai-plan/regenerate.test.ts src/lib/ai-plan/draft-to-plan.ts
git commit -m "[FE] feat: 재생성 초안에서 목표 일자만 뽑는다"
```

---

### Task 4: mock 재생성 갈래

**Files:**

- Modify: `src/lib/api/mock/ai-plan-data.ts`
- Test: `src/lib/api/mock/ai-plan-mock.test.ts`

**Interfaces:**

- Consumes: 없음 (mock 은 서버 흉내다)
- Produces: `MOCK_API=true` 에서 `planId` + `regenerateDay` 제출이 **그 일자만 다른** 초안을 준다. Task 7 의 브라우저 실렌더가 이것에 기댄다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/api/mock/ai-plan-mock.test.ts` 맨 아래 `describe` 를 더한다. 파일 위쪽의 `submitMock` 헬퍼(20행)를 그대로 쓴다.

```ts
describe('하루 재생성 (#128)', () => {
  const PLAN_ID = '223456789012000001'

  function base() {
    return {
      areaCode: '39',
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      petIds: ['123456789012000001'],
    }
  }

  /*
    `AiPlanJobProcessor:191` — 둘 중 하나만 오면 막는다. mock 이 이 짝 규칙을 지켜야
    FE 가 한쪽만 실어 보내는 회귀를 로컬에서 잡는다.
  */
  it('planId 만 오면 400 이다', () => {
    expect(submitMock({ ...base(), planId: PLAN_ID })?.status).toBe(400)
  })

  it('regenerateDay 만 와도 400 이다', () => {
    expect(submitMock({ ...base(), regenerateDay: 2 })?.status).toBe(400)
  })

  it('일차가 기간을 넘으면 400 이다', () => {
    expect(submitMock({ ...base(), planId: PLAN_ID, regenerateDay: 99 })?.status).toBe(400)
  })

  it('짝으로 오면 접수한다', () => {
    expect(submitMock({ ...base(), planId: PLAN_ID, regenerateDay: 2 })?.status).toBe(202)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/api/mock/ai-plan-mock.test.ts`
Expected: FAIL — 처음 세 개가 `202` 를 받는다 (mock 이 아직 두 필드를 모른다)

- [ ] **Step 3: mock 에 검증을 더한다**

`src/lib/api/mock/ai-plan-data.ts` 의 `submit()` 안, `errors` 를 반환하기 **전에** 더한다.

```ts
  /*
    하루 재생성 (#128). **둘은 짝이다** — `AiPlanJobProcessor:188-195` 가 하나만 오면
    막고, 일차가 일정 기간을 넘어도 막는다.
  */
  const regeneratePlanId = asIdString(parsed.planId)
  const regenerateDay =
    typeof parsed.regenerateDay === 'number' ? parsed.regenerateDay : null

  if ((regeneratePlanId === null) !== (regenerateDay === null)) {
    errors.push({
      code: 'AIPLAN_016',
      field: 'regenerateDay',
      message: 'planId 와 regenerateDay 는 함께 지정해야 합니다.',
    })
  }

  if (regeneratePlanId !== null && regenerateDay !== null) {
    const target = MOCK_PLANS.find(
      (candidate) => candidate.planId === regeneratePlanId && !candidate.deleted,
    )
    const dayCount = target === undefined ? 0 : dayCountOf(target)

    if (regenerateDay < 1 || regenerateDay > dayCount) {
      errors.push({
        code: 'AIPLAN_015',
        field: 'regenerateDay',
        message: '다시 구성할 일차가 여행 기간을 벗어났습니다.',
      })
    }
  }
```

일수 계산 헬퍼를 같은 파일 아래쪽에 더한다 (이미 있으면 그것을 쓴다).

```ts
/** 시작·종료일로 총 일수를 센다. 백엔드 `Plan.totalDays()` 와 같은 셈이다 (양끝 포함) */
function dayCountOf(plan: { startDate: string; endDate: string }): number {
  const start = Date.parse(`${plan.startDate}T00:00:00Z`)
  const end = Date.parse(`${plan.endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.floor((end - start) / 86_400_000) + 1
}
```

`MOCK_PLANS` 를 아직 import 하지 않았다면 더한다 — 이 파일이 이미 `packingList` 에서 일정을 찾고 있으므로(251행) 같은 참조를 쓴다.

- [ ] **Step 4: 재생성 초안이 그 날만 다르게 나오게 한다**

초안은 `draftFor(job)`(`ai-plan-data.ts`)가 만들고 작업 레코드(`MockAiPlanJob`)에서 조건을 읽는다. 그래서 **제출 때 `regenerateDay` 를 레코드에 함께 저장**하고 초안을 만들 때 읽는다.

먼저 `src/lib/api/mock/store.ts` 의 `MockAiPlanJob` 에 필드를 더한다.

```ts
  /**
   * 하루 재생성 대상 일차 (#128). 새 일정 생성이면 `null` 이다.
   *
   * **초안은 재생성이어도 전체 일정을 담는다** — 서버 프롬프트가 그렇게 지시한다
   * (`AiPlanPromptFactory#appendRegenerateSection`). 이 값은 *어느 날을 다르게 낼지*
   * 를 가리킬 뿐 초안의 범위를 좁히지 않는다. mock 이 전체를 주어야 FE 의
   * "목표 일자만 뽑는다" 판단(하루재생성-세부명세 R4)이 로컬에서 검증된다.
   */
  regenerateDay: number | null
```

`ai-plan-data.ts` 의 `submit()` 이 레코드를 만드는 자리(461행 `const job: MockAiPlanJob = {`)에 더한다.

```ts
    regenerateDay,
```

`draftFor(job)` 안에서 일자별 항목을 만드는 자리에, 목표 일자면 **다른 장소**를 쓴다.

```ts
/**
 * 재생성 대상 일자의 항목. **다른 날과 눈에 띄게 달라야 한다** — 비교 화면
 * (하루재생성-세부명세 R5)이 "무엇이 바뀌는지" 를 보여 주는 것이 요점이라, mock 이
 * 같은 항목을 주면 그 화면을 로컬에서 확인할 수 없다.
 */
function regeneratedDayItems(): AiPlanScheduleItem[] {
  return [
    { itemType: 'PLACE', placeId: MOCK_PLACES[2]?.placeId ?? null, title: '오설록 티뮤지엄 카페', note: '실내라 비가 와도 괜찮아요' },
    { itemType: 'WALK', placeId: MOCK_PLACES[1]?.placeId ?? null, title: '사려니숲길 산책', note: '그늘이 많아요' },
  ]
}
```

`draftFor` 가 일자를 돌 때 갈래를 준다.

```ts
    days.push({
      day,
      items: job.regenerateDay === day ? regeneratedDayItems() : items,
    })
```

`MOCK_PLACES` 를 이미 import 하고 있다(초안이 실제 placeId 를 쓴다). 없으면 더한다.

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/api/mock/`
Expected: PASS — 새 4건과 기존 mock 테스트 전부

- [ ] **Step 6: 커밋**

```bash
git add src/lib/api/mock/ai-plan-data.ts src/lib/api/mock/ai-plan-mock.test.ts
git commit -m "[FE] feat: mock 이 하루 재생성 갈래를 흉내 낸다"
```

---

### Task 5: 문구와 진입점

**Files:**

- Modify: `src/lib/messages/plan.ts`
- Modify: `src/features/plan/plan-day-section.tsx`
- Modify: `src/features/plan/plan-detail-section.tsx`
- Test: `src/features/plan/plan-detail.test.ts`

**Interfaces:**

- Consumes: 없음
- Produces: `PlanDaySection` 이 `regenerateHref: string` prop 을 받는다. Task 7 의 라우트가 그 링크의 목적지다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/plan/plan-detail.test.ts` 의 `PlanDaySection` describe 블록에 더한다. 그 파일의 기존 렌더 헬퍼를 쓴다 (없으면 `PlanOverviewPanel` 쪽 `renderOverview` 와 같은 모양으로 만든다).

```ts
  it('일자 헤더에 다시 만들기가 있고 재생성 라우트를 가리킨다 (#128)', () => {
    const markup = renderDaySection({ regenerateHref: '/plans/1/days/2/regenerate' })

    expect(markup).toContain(messages.plan.regenerateDayAction)
    expect(markup).toContain('href="/plans/1/days/2/regenerate"')
  })

  /*
    R3-2. 빈 날을 채우는 것이 이 기능이 가장 쓸모 있는 순간이다 — `순서 편집` 과 달리
    항목 수를 보지 않는다 (`장소 추가` 와 같은 판단).
  */
  it('항목이 0개인 날에도 남는다', () => {
    const markup = renderDaySection({ rows: [], regenerateHref: '/plans/1/days/3/regenerate' })

    expect(markup).toContain(messages.plan.regenerateDayAction)
    expect(markup).not.toContain(messages.plan.editDayAction)
  })
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/plan/plan-detail.test.ts`
Expected: FAIL — `messages.plan.regenerateDayAction` 이 `undefined`

- [ ] **Step 3: 문구를 더한다**

`src/lib/messages/plan.ts` 의 `editDayAction` 근처에 더한다.

```ts
  // ── 하루 재생성 (#128 · 하루재생성-세부명세 R7) ─────────────────────────────
  /** 일자 헤더 버튼. `장소 추가`·`순서 편집` 과 같은 줄이라 짧게 둔다 */
  regenerateDayAction: '다시 만들기',
  /** `{day}` 치환. 재생성 화면의 제목 */
  regenerateDayPageTitle: '{day}일차 다시 만들기',
  regenerateDayNoteLabel: '이 날에 바라는 것 (선택)',
  regenerateDayNotePlaceholder: '실내 위주로 부탁해요',
  regenerateDaySubmit: '이 날 다시 만들기',
  regenerateDayCurrent: '지금',
  regenerateDayNext: '이렇게 바뀌어요',
  regenerateDayEmpty: '아직 담은 곳이 없어요',
  regenerateDayApply: '이 날 바꾸기',
  /**
   * 되돌리기를 만들 수 없다 — 계약에 일자 이력이 없다. **확정 전에 사실을 말하는 것**이
   * 유일한 방어다 (R5).
   */
  regenerateDayIrreversible: '지금 이 날의 항목은 사라지고 되돌릴 수 없어요.',
  /** 초안에 목표 일자가 없을 때 (R4-2). 빈 항목으로 저장하지 않는다 */
  regenerateDayMissing: '이 날을 다시 만들지 못했어요. 다시 시도해 주세요.',
  /**
   * '다녀옴' 초기화 (R5). **`visitResetNotice` 를 재사용하지 않는다** — 그 문구는
   * *"순서를 바꾸거나 장소를 담으면"* 이라고 계기 둘을 못박아 두었고 재생성은 거기
   * 없다. 그대로 쓰면 화면이 사실과 다른 말을 한다. 초기화되는 **이유는 같다**:
   * 일괄 교체가 새 `planItemId` 를 발급한다.
   */
  regenerateDayVisitReset: '이 날 항목이 바뀌면 ‘다녀옴’ 표시가 초기화돼요.',
```

- [ ] **Step 4: 진입점을 단다**

`src/features/plan/plan-day-section.tsx` 의 props 에 더한다.

```ts
  /** `다시 만들기` 가 가는 곳 (#128). `장소 추가` 와 같이 모달이 아니라 라우트다 */
  regenerateHref: string
```

헤더의 `ml-auto` 묶음에서 **`장소 추가` 와 `순서 편집` 사이**에 넣는다.

```tsx
            {/*
              **빈 일자에도 남는다** — 빈 날을 채우는 것이 이 기능이 가장 쓸모 있는
              순간이다 (하루재생성-세부명세 R3-2). `순서 편집` 과 달리 항목 수를 보지 않는다.
            */}
            <ButtonLink href={regenerateHref} variant="secondary" size="sm">
              {messages.plan.regenerateDayAction}
            </ButtonLink>
```

`src/features/plan/plan-detail-section.tsx` 에서 `add={{...}}` 를 넘기는 자리 옆에 더한다.

```tsx
              regenerateHref={`/plans/${plan.planId}/days/${group.day}/regenerate`}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/features/plan/`
Expected: PASS

- [ ] **Step 6: 세 버튼이 375 에서 어떻게 접히는지 본다**

일자 헤더에 버튼이 **둘에서 셋으로** 늘었다. 부모가 `flex-wrap` 이라 접히지만 실제 모습을 확인한다.

```bash
cd frontend && nohup node ./node_modules/next/dist/bin/next dev -p 5174 > /tmp/next-dev.log 2>&1 &
```

브라우저를 `http://localhost:5174/plans/223456789012000001` 로 열고 375 폭에서 1일차 헤더를 본다. 버튼이 두 줄로 접혀도 좋다 — **가로로 넘치지만 않으면 된다.** `main` 하위에 뷰포트를 넘는 요소가 0건인지 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/messages/plan.ts src/features/plan/plan-day-section.tsx src/features/plan/plan-detail-section.tsx src/features/plan/plan-detail.test.ts
git commit -m "[FE] feat: 일정 상세 일자에 다시 만들기 진입점을 단다"
```

---

### Task 6: 비교와 확정 블록

**Files:**

- Create: `src/features/plan/plan-day-diff.tsx`
- Create: `src/features/plan/plan-day-regenerate-confirm.tsx`
- Test: `src/features/plan/plan-day-diff.test.ts`
- Test: `src/features/plan/plan-day-regenerate-confirm.test.ts`

**Interfaces:**

- Consumes: Task 5 의 문구 · 기존 `PlanDaySaveError`(`lib/plan/save-error.ts`)
- Produces:
  - `PlanDayDiff({ current, next }: { current: readonly PlanDayDiffRow[]; next: readonly PlanDayDiffRow[] })` 와 `export type PlanDayDiffRow = { title: string; caption: string | null }`. Task 7 이 `PlanItemDetail` 과 `PlanItemRequest` 를 각각 이 모양으로 옮겨 넘긴다.
  - `PlanDayRegenerateConfirm({ onApply, applying, error }: { onApply: () => void; applying: boolean; error: PlanDaySaveError | null })`. Task 7 이 비교 아래에 놓는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/plan/plan-day-diff.test.ts` 를 만든다.

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayDiff, type PlanDayDiffRow } from '@/features/plan/plan-day-diff'
import { messages } from '@/lib/messages'

const CURRENT: PlanDayDiffRow[] = [
  { title: '제주특별자치도립김창열미술관', caption: '제주시 한림읍 · 실내' },
  { title: '동문재래시장', caption: '제주시 · 야외' },
]

const NEXT: PlanDayDiffRow[] = [
  { title: '오설록 티뮤지엄 카페', caption: '서귀포시 안덕면 · 실내' },
  { title: '사려니숲길 산책', caption: null },
]

function render(overrides: Partial<Parameters<typeof PlanDayDiff>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayDiff, { current: CURRENT, next: NEXT, ...overrides }),
  )
}

describe('PlanDayDiff', () => {
  it('양쪽 제목을 모두 낸다', () => {
    const markup = render()

    expect(markup).toContain('제주특별자치도립김창열미술관')
    expect(markup).toContain('오설록 티뮤지엄 카페')
  })

  it('두 열의 이름을 낸다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.regenerateDayCurrent)
    expect(markup).toContain(messages.plan.regenerateDayNext)
  })

  it('caption 이 null 이면 그 줄만 빠지고 제목은 남는다', () => {
    expect(render()).toContain('사려니숲길 산책')
  })

  /*
    R5. 항목이 0개인 날에도 진입점이 있으므로 "지금" 이 비는 경우가 실제로 생긴다.
    비었다고 말하고 넘어간다 — 그 상태가 사실이다.
  */
  it('지금이 비면 빈 안내를 낸다', () => {
    const markup = render({ current: [] })

    expect(markup).toContain(messages.plan.regenerateDayEmpty)
    expect(markup).toContain('오설록 티뮤지엄 카페')
  })

  it('순서를 1부터 매겨 보여 준다', () => {
    const markup = render()

    expect(markup).toContain('>1<')
    expect(markup).toContain('>2<')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/plan/plan-day-diff.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/plan/plan-day-diff"`

- [ ] **Step 3: 최소 구현**

`src/features/plan/plan-day-diff.tsx` 를 만든다.

```tsx
import { messages } from '@/lib/messages'

/**
 * 재생성 확정 전 비교 (#128 · 하루재생성-세부명세 R5).
 *
 * **교체는 되돌릴 수 없다.** 계약에 일자 이력이 없어 undo 를 만들 수 없으므로,
 * **무엇을 잃는지 눈으로 보여 주는 것이 유일한 방어다.**
 *
 * 두 열이 서로 다른 타입에서 온다 — 왼쪽은 저장된 `PlanItemDetail`, 오른쪽은 아직
 * 보내지 않은 `PlanItemRequest` 다. **여기서 한 모양으로 좁혀 받는다** — 컴포넌트가
 * 두 타입을 다 알면 저장 형식이 바뀔 때마다 이 파일이 함께 흔들린다.
 */
export type PlanDayDiffRow = {
  title: string
  /** 주소·유형 같은 부연. 없으면 줄 자체가 빠진다 */
  caption: string | null
}

export function PlanDayDiff({
  current,
  next,
}: {
  current: readonly PlanDayDiffRow[]
  next: readonly PlanDayDiffRow[]
}) {
  return (
    /* 모바일은 위아래, 데스크톱은 좌우. 좁은 화면에서 두 열을 붙이면 제목이 뭉갠다 */
    <div className="grid gap-4 md:grid-cols-2">
      <DiffColumn title={messages.plan.regenerateDayCurrent} rows={current} />
      <DiffColumn title={messages.plan.regenerateDayNext} rows={next} />
    </div>
  )
}

function DiffColumn({ title, rows }: { title: string; rows: readonly PlanDayDiffRow[] }) {
  return (
    <section className="border-border rounded-md border p-4">
      <h3 className="text-caption text-fg-muted font-semibold">{title}</h3>

      {rows.length === 0 ? (
        <p className="text-body-2 text-fg-muted mt-3">{messages.plan.regenerateDayEmpty}</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={`${index}-${row.title}`} className="flex items-start gap-3">
              <span className="bg-band text-fg-muted text-caption flex w-6 shrink-0 items-center justify-center rounded-sm font-bold tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-body-2 text-fg font-semibold break-keep">{row.title}</p>
                {row.caption !== null && (
                  <p className="text-caption text-fg-muted mt-0.5 line-clamp-1 font-medium">
                    {row.caption}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/plan/plan-day-diff.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 확정 블록의 실패하는 테스트를 쓴다**

명세 R9 가 _"되돌릴 수 없다는 문구와 '다녀옴' 초기화 문구가 확정 버튼 앞에 있다"_ 를 요구한다. **뷰는 훅이 붙어 있어 node 환경에서 렌더할 수 없으므로**(jsdom 없음) 그 블록을 훅 없는 컴포넌트로 뗀다.

`src/features/plan/plan-day-regenerate-confirm.test.ts` 를 만든다.

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDayRegenerateConfirm } from '@/features/plan/plan-day-regenerate-confirm'
import { messages } from '@/lib/messages'

function render(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayRegenerateConfirm, {
      onApply: () => undefined,
      applying: false,
      error: null,
      ...overrides,
    }),
  )
}

describe('PlanDayRegenerateConfirm', () => {
  /*
    R5. 계약에 일자 이력이 없어 undo 를 만들 수 없다. **확정 전에 사실을 말하는 것**이
    유일한 방어다.
  */
  it('되돌릴 수 없다는 것과 다녀옴 초기화를 함께 말한다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.regenerateDayIrreversible)
    expect(markup).toContain(messages.plan.regenerateDayVisitReset)
  })

  it('두 경고가 확정 버튼보다 앞에 온다', () => {
    const markup = render()

    expect(markup.indexOf(messages.plan.regenerateDayIrreversible)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
    expect(markup.indexOf(messages.plan.regenerateDayVisitReset)).toBeLessThan(
      markup.indexOf(messages.plan.regenerateDayApply),
    )
  })

  it('저장 실패 문구를 낸다', () => {
    expect(render({ error: { message: '사라진 장소가 있어요.', retriable: false } })).toContain(
      '사라진 장소가 있어요.',
    )
  })
})
```

- [ ] **Step 6: 실패를 확인한다**

Run: `npx vitest run src/features/plan/plan-day-regenerate-confirm.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/plan/plan-day-regenerate-confirm"`

- [ ] **Step 7: 확정 블록을 만든다**

`src/features/plan/plan-day-regenerate-confirm.tsx` 를 만든다. **훅을 쓰지 않는다** — 상태는 뷰가 들고 이 컴포넌트는 받은 것만 그린다.

```tsx
import { Button } from '@/components/button'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 재생성 확정 블록 (#128 · 하루재생성-세부명세 R5).
 *
 * **경고가 버튼보다 먼저 온다.** 교체는 되돌릴 수 없고 계약에 일자 이력이 없어 undo 를
 * 만들 수 없다 — 확정 전에 사실을 말하는 것이 유일한 방어다.
 *
 * **훅이 없다.** 뷰는 작업 구독 때문에 클라이언트 훅이 붙어 node 환경 테스트로 렌더할
 * 수 없다. 눈으로만 확인해야 하는 경고를 그 안에 두면 검증에서 빠진다.
 */
export function PlanDayRegenerateConfirm({
  onApply,
  applying,
  error,
}: {
  onApply: () => void
  applying: boolean
  /** 되붙이기 실패. `toPlanDaySaveError` 가 분류한 그대로다 */
  error: PlanDaySaveError | null
}) {
  return (
    <div className="border-border mt-6 flex flex-col items-start gap-2 border-t pt-4">
      <p className="text-body-2 text-fg font-semibold">
        {messages.plan.regenerateDayIrreversible}
      </p>
      <p className="text-caption text-fg-muted font-medium">
        {messages.plan.regenerateDayVisitReset}
      </p>

      {error !== null && (
        <p className="text-body-2 text-danger mt-1">{error.message}</p>
      )}

      <Button className="mt-2" onClick={onApply} loading={applying}>
        {messages.plan.regenerateDayApply}
      </Button>
    </div>
  )
}
```

`text-danger` 가 이 저장소의 오류 색 토큰이 아니면 **다른 오류 표시가 쓰는 클래스를 그대로 가져다 쓴다** (`grep -rn "오류" src/components/error-state.tsx` 로 확인). 색을 새로 정하지 않는다.

- [ ] **Step 8: 통과를 확인한다**

Run: `npx vitest run src/features/plan/plan-day-diff.test.ts src/features/plan/plan-day-regenerate-confirm.test.ts`
Expected: PASS (6 + 3 tests)

- [ ] **Step 9: 커밋**

```bash
git add src/features/plan/plan-day-diff.tsx src/features/plan/plan-day-diff.test.ts src/features/plan/plan-day-regenerate-confirm.tsx src/features/plan/plan-day-regenerate-confirm.test.ts
git commit -m "[FE] feat: 재생성 비교와 확정 블록을 만든다"
```

---

### Task 7: 화면 조립 · 라우트 · 문서

**Files:**

- Create: `src/features/plan/plan-day-regenerate-view.tsx`
- Create: `src/features/plan/plan-day-regenerate.test.ts`
- Create: `app/(main)/plans/[planId]/days/[day]/regenerate/page.tsx`
- Modify: `frontend/docs/features/ai-plan/공통명세.md` (S2)
- Modify: `frontend/docs/screen-inventory.md`

**Interfaces:**

- Consumes: `toDayRegeneratePayload`(T2) · `toRegeneratedDayItems`(T3) · `PlanDayDiff`/`PlanDayDiffRow`(T6) · 문구(T5) · `useAiPlanJob`(기존) · `submitAiPlan`·`replaceDayItems`(기존) · `toPlanDaySaveError`(기존)
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/plan/plan-day-regenerate.test.ts` 를 만든다. **뷰 전체가 아니라 순수 분기만 문자열로 검증한다** — 이 저장소에는 jsdom 이 없어 클라이언트 훅이 붙은 트리를 통째로 렌더할 수 없다. 그래서 화면이 쓰는 두 변환을 export 해서 잠근다.

```ts
import { describe, expect, it } from 'vitest'

import { toDiffRows, toNextDiffRows } from '@/features/plan/plan-day-regenerate-view'
import type { PlanItemDetail, PlanItemRequest } from '@/types/plan'

const saved = [
  {
    planItemId: '1',
    day: 1,
    sequence: 0,
    itemType: { code: 'PLACE', name: '장소', description: null },
    targetId: '111',
    title: '제주특별자치도립김창열미술관',
    memo: null,
    startTime: null,
    visited: true,
    place: { placeId: '111', title: '제주특별자치도립김창열미술관', addr1: '제주시 한림읍' },
  },
] as unknown as PlanItemDetail[]

const next: PlanItemRequest[] = [
  { day: 1, sequence: 0, itemType: 'PLACE', targetId: '222', title: '오설록 티뮤지엄 카페' },
  { day: 1, sequence: 1, itemType: 'WALK', title: '사려니숲길 산책', memo: '그늘이 많아요' },
]

describe('toDiffRows — 저장된 항목', () => {
  it('제목과 주소를 옮긴다', () => {
    expect(toDiffRows(saved)).toEqual([
      { title: '제주특별자치도립김창열미술관', caption: '제주시 한림읍' },
    ])
  })

  it('빈 목록은 빈 목록이다', () => {
    expect(toDiffRows([])).toEqual([])
  })
})

describe('toNextDiffRows — 새 초안 항목', () => {
  /*
    새 항목에는 아직 장소 요약이 없다 — 보내기 전이라 서버가 채워 주지 않았다.
    **주소를 지어내지 않는다.** 메모가 있으면 그것을 쓰고 없으면 비운다.
  */
  it('메모가 있으면 caption 으로 쓴다', () => {
    expect(toNextDiffRows(next)[1]).toEqual({
      title: '사려니숲길 산책',
      caption: '그늘이 많아요',
    })
  })

  it('메모가 없으면 caption 이 null 이다', () => {
    expect(toNextDiffRows(next)[0]?.caption).toBeNull()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/plan/plan-day-regenerate.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/plan/plan-day-regenerate-view"`

- [ ] **Step 3: 뷰를 만든다**

`src/features/plan/plan-day-regenerate-view.tsx` 를 만든다. 세 상태를 순서대로 분기한다.

```tsx
'use client'
```

**구현 규칙** (지키지 않으면 리뷰에서 되돌아온다):

1. **`jobId` 는 `useSearchParams()` 로 읽고, 제출 성공 시 `router.replace` 로 붙인다.** `push` 가 아니다 — 뒤로 가기가 제출 전으로 돌아가야 한다.
2. **대기·실패·완료 분기는 `ai-plan-job-view.tsx` 의 순서를 그대로 따른다.** 조회 오류 → 작업 실패(`isJobFailed`, HTTP 200) → 진행 중(`polling`) → 완료. 순서를 바꾸면 실패가 진행 중으로 보인다.
3. **`AiPlanProgress` 와 `AiPlanFailed` 를 그대로 쓴다.** `AiPlanFailed` 의 `changeHref` 는 이 화면의 제출 상태(`?jobId=` 없는 주소)를 가리킨다.
4. **완료인데 목표 일자가 없으면**(`toRegeneratedDayItems` 가 `null`) `messages.plan.regenerateDayMissing` 과 다시 시도를 낸다. **빈 배열로 `replaceDayItems` 를 부르지 않는다** — 그 일자가 통째로 지워진다.
5. **확정 블록은 Task 6 의 `PlanDayRegenerateConfirm` 을 쓴다.** 경고 두 줄을 뷰 안에 직접 쓰지 않는다 — 훅이 붙은 뷰는 node 환경 테스트로 렌더할 수 없어 검증에서 빠진다.
6. **저장 실패는 `toPlanDaySaveError(cause, copy)` 로 분류한다.** `PLAN_004` 면 그 장소를 `excludedPlaceIds` 에 넣고 다시 만든 항목으로 재시도할 수 있게 한다 — 초안을 버리지 않는다.
7. **`toRegeneratedDayItems` 의 `PlanItemRequest[]` 를 그대로 `replaceDayItems` 에 넘긴다.** `PlanDayItemsReplacePayload.items` 는 `PlanItemPayload[]` 인데 두 타입은 `itemType` 만 다르고(`PlanItemTypeCode` ⊂ `string`) 구조적으로 대입된다 — **변환 함수를 새로 만들지 않는다.**
8. **성공하면 `router.replace(`/plans/${planId}#day${day}`)`** 로 돌아간다. `planKeys.detail(planId)` 는 `setQueryData` 로 응답을 갈아끼우고 `planKeys.weather(planId)` 는 `invalidateQueries` 한다 — **두 key 가 나뉘어 있으므로 둘 다 다룬다** (`queries.ts:12`).
9. `day > plan.totalDays` 면 화면을 세우지 않고 `/plans/{planId}` 로 보낸다 (R2).
10. 메모 `<textarea>` 에 `maxLength={500}` 을 건다 — 매핑이 자르지 않으므로 여기서 막는다.

테스트가 부르는 두 변환을 **export** 한다.

```tsx
/** 저장된 항목 → 비교 행. 주소는 서버가 채워 준 장소 요약에서만 온다 (#86) */
export function toDiffRows(items: readonly PlanItemDetail[]): PlanDayDiffRow[] {
  return items.map((item) => ({
    title: item.title,
    caption: item.place?.addr1 ?? null,
  }))
}

/**
 * 새 초안 항목 → 비교 행.
 *
 * **주소를 지어내지 않는다.** 아직 보내지 않은 항목이라 장소 요약이 없다 — 메모가
 * 있으면 그것을 쓰고, 없으면 비운다.
 */
export function toNextDiffRows(items: readonly PlanItemRequest[]): PlanDayDiffRow[] {
  return items.map((item) => ({
    title: item.title,
    caption: item.memo ?? null,
  }))
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/plan/plan-day-regenerate.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 라우트를 만든다**

`app/(main)/plans/[planId]/days/[day]/regenerate/page.tsx` 를 만든다. **같은 폴더의 `add/page.tsx` 를 본으로 삼되 장소 목록 프리페치는 뺀다** — 이 화면은 장소를 고르지 않는다.

```tsx
import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { PlanDayRegenerateView } from '@/features/plan/plan-day-regenerate-view'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { planDetailPath } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PlanDetail } from '@/types/plan'

/**
 * 하루 재생성 — 하루재생성-세부명세 R2.
 *
 * **`loading.tsx` 를 두지 않는다.** 아래 `notFound()` 가 HTTP 상태를 바꿔야 하는데
 * Suspense 경계가 있으면 응답이 먼저 스트리밍돼 soft 404 가 된다
 * (`days/[day]/add/page.tsx` 와 같은 이유).
 */
export async function generateMetadata({ params }: { params: Params }) {
  const { day } = await params
  /*
    **일차를 제목에 넣는다.** `days/[day]/add` 는 일정 제목이 필요해 정적 문구를 썼지만
    (백엔드를 한 번 더 불러야 한다) 일차는 경로에 이미 있어 공짜다.
  */
  return {
    title: `${messages.plan.regenerateDayPageTitle.replace('{day}', day)} · 혼디가개`,
  }
}

type Params = Promise<{ planId: string; day: string }>

export default async function PlanDayRegeneratePage({ params }: { params: Params }) {
  const { planId, day: rawDay } = await params

  /*
    경로의 `day` 를 여기서 막는다 — 백엔드 `@PathVariable int` 라 숫자가 아니면 400 이고,
    형식이 틀린 주소는 없는 페이지다. **기간 상한은 뷰가 판단한다** — 라우트는
    `totalDays` 를 모른다.
  */
  if (!/^\d+$/.test(rawDay)) notFound()
  const day = Number(rawDay)
  if (day < 1) notFound()

  const session = await readSession()
  const queryClient = getServerQueryClient()

  try {
    await queryClient.fetchQuery({
      queryKey: planKeys.detail(planId),
      queryFn: () =>
        serverFetch<PlanDetail>(planDetailPath(planId), { accessToken: session?.accessToken }),
      retry: false,
    })
  } catch (error) {
    // 백엔드는 본인 소유가 아니어도 404 다 — 화면도 존재 여부를 흘리지 않는다
    if (error instanceof ApiError && error.kind === 'not-found') notFound()
  }

  return (
    <main id="main-content">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PlanDayRegenerateView planId={planId} day={day} />
      </HydrationBoundary>
    </main>
  )
}
```

**새 문구 키를 만들지 않는다.** Task 5 의 `messages.plan.regenerateDayPageTitle`(`{day}일차 다시 만들기`)을 화면 제목과 탭 제목이 함께 쓴다 — 명세 R7 표에 있는 그 키다.

- [ ] **Step 6: 전체 검증**

```bash
pnpm verify
pnpm format:check
```

Expected: 전부 통과. 실패하면 여기서 멈추고 고친다.

```bash
BACKEND_API_URL=http://localhost:8000 \
AUTH_SESSION_SECRET=ci-placeholder-secret-at-least-32-characters \
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=ci-placeholder \
pnpm build
```

Expected: 빌드 성공. **server/client 경계 오류는 빌드에서만 잡히는 것이 많다.**

- [ ] **Step 7: 브라우저로 흐름을 끝까지 본다**

```bash
cd frontend && nohup node ./node_modules/next/dist/bin/next dev -p 5174 > /tmp/next-dev.log 2>&1 &
```

`MOCK_API=true` 로 로그인한 뒤 확인한다 (계정은 `docs/local-run-guide.md`).

1. `/plans/223456789012000001` 1일차 헤더에 `다시 만들기` 가 있다
2. 누르면 `/plans/223456789012000001/days/1/regenerate` 로 간다
3. 메모를 넣고 제출하면 주소에 `?jobId=` 가 붙는다 (`replace` 라 뒤로 가기가 제출 전으로 간다)
4. 진행 표시가 나오고 완료되면 **지금 / 이렇게 바뀌어요** 두 열이 나온다
5. 새로고침해도 같은 작업으로 돌아온다
6. `이 날 바꾸기` 를 누르면 `/plans/...#day1` 로 돌아가고 **그 일자만** 바뀌어 있다
7. 다른 날은 그대로다 — R4 의 핵심이다
8. 375 · 768 · 1280 에서 `main` 하위에 뷰포트를 넘는 요소가 0건이다

- [ ] **Step 8: 문서를 갱신한다**

`frontend/docs/features/ai-plan/공통명세.md` S2(화면 범위)에 이 화면을 더하고, `frontend/docs/screen-inventory.md` 에 라우트를 더한다. **코드 변경과 문서 변경은 같이 움직인다.**

- [ ] **Step 9: 커밋**

```bash
git add app src/features/plan src/lib/messages docs
git commit -m "[FE] feat: 일정의 하루를 AI 로 다시 만든다"
```

---

## 마무리

- [ ] `#128` 의 마지막 체크박스를 체크하고 세부명세와 PR 을 잇는다
- [ ] PR 본문에 **아트보드 03 이탈 근거**(R1)와 **다른 날을 반영하지 않는 이유**(R4)를 적는다 — 리뷰어가 가장 먼저 물을 두 가지다
- [ ] PR 본문 `Issue Number: #128`
