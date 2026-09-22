# AI 일정 생성 반려견 다중 선택 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** AI 일정 생성에서 반려견을 여러 마리 고를 수 있게 하고, 담기 직전에 판정 기준이 될 한 마리를 명시적으로 고르게 한다.

**Architecture:** 백엔드 생성 계약(`AiPlanCreateRequest.petIds`, 최대 5)이 이미 다견을 지원하므로 새 API 를 만들지 않는다. FE 는 폼 값·제출 본문·`sessionStorage` 스냅샷을 배열로 바꾸고, 담기(`POST /plans`)가 `petId` 단일이라 그 한 마리를 담기 패널에서 받는다. 저장·판정의 다견화는 BE 선행이 필요해 범위 밖이다.

**Tech Stack:** Next.js App Router · TypeScript · zod · vitest(node 환경, `renderToStaticMarkup`) · pnpm

**Spec:** `frontend/docs/features/ai-plan/다견선택-세부명세.md`

## Global Constraints

- 모든 명령은 `frontend/` 에서 실행한다.
- 게이트: `pnpm verify` (= `lint && typecheck && test`) 와 `pnpm format:check` 가 **둘 다** 통과해야 한다.
- 테스트는 **node 환경 + `renderToStaticMarkup` 문자열 단언**이다. jsdom·testing-library 없음. 파일명은 `*.test.ts` (`.tsx` 아님). JSX 대신 `createElement`. — `docs/testing-guide.md` §1
- **React Query 훅·Zustand 를 쓰는 컴포넌트는 렌더되지 않는다.** 판정 로직은 순수 함수로 뽑아 테스트한다.
- Snowflake ID 는 **문자열로 유지**한다. `Number()` 를 거치면 정밀도를 잃는다.
- 반려견 상한은 `MAX_PET_COUNT`(`@/lib/api/pet`, 값 5)를 쓴다. 백엔드 `@Size(max = 5)` 와 같은 값이지만 **숫자를 새로 적지 않는다.**
- 문구는 **해요체**로 고정한다 (`message-tone.test.ts` 가 합쇼체를 잡는다). 새 문구는 `src/lib/messages/ai-plan.ts` 에만 둔다.
- 컴포넌트 `className` 으로 외형(색·radius·shadow·padding)을 덮지 않는다. 레이아웃 유틸리티만.
- 커밋 prefix 는 `[FE]`, 본문 끝에 `Issue Number: #128`.
- 브랜치: `feature/fe/128-multi-pet-select` (이미 존재. 명세 커밋 `010e6dd` 가 올라가 있다)

---

### Task 1: 폼 값·제출 본문을 `petIds` 로 바꾼다

**Files:**

- Modify: `src/types/ai-plan.ts` (`AiPlanFormValues`, `AiPlanSubmitPayload`, `EMPTY_AI_PLAN_FORM_VALUES`)
- Modify: `src/features/ai-plan/schemas.ts` (`aiPlanFormSchema`)
- Modify: `src/lib/ai-plan/submit.ts`
- Modify: `src/lib/messages/ai-plan.ts` (문구 1개 추가)
- Test: `src/lib/ai-plan/submit.test.ts`

**Interfaces:**

- Produces: `AiPlanFormValues.petIds: string[]` · `AiPlanSubmitPayload.petIds: string[]` · `messages.aiPlan.errorPetTooMany`
- Consumes: 없음 (첫 태스크)

- **Step 1: 실패하는 테스트를 쓴다**

`src/lib/ai-plan/submit.test.ts` 에서 기존 `petId` 단언을 아래로 **교체**한다. 기존
`it('아직 보내지 않는 필드가 새어 나가지 않는다 — petIds·planId·regenerateDay', ...)` 도
아래 마지막 테스트로 교체한다 (명세 D2-2 — `petIds` 만 잠금에서 뺀다).

```ts
it('petIds 를 배열로 보낸다', () => {
  const payload = toAiPlanSubmitPayload({
    ...EMPTY_AI_PLAN_FORM_VALUES,
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    petIds: ['1234567890123456789', '9876543210987654321'],
  })

  expect(payload.petIds).toEqual(['1234567890123456789', '9876543210987654321'])
})

it('한 마리여도 배열이다 — 분기를 만들지 않는다 (명세 D2-2)', () => {
  const payload = toAiPlanSubmitPayload({
    ...EMPTY_AI_PLAN_FORM_VALUES,
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    petIds: ['1234567890123456789'],
  })

  expect(payload.petIds).toEqual(['1234567890123456789'])
  expect('petId' in payload).toBe(false)
})

it('Snowflake 를 숫자로 바꾸지 않는다', () => {
  const payload = toAiPlanSubmitPayload({
    ...EMPTY_AI_PLAN_FORM_VALUES,
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    petIds: ['9007199254740993'],
  })

  expect(payload.petIds[0]).toBe('9007199254740993')
})

it('planId·regenerateDay 는 여전히 새지 않는다 — 아직 미완성이다 (#90)', () => {
  const payload = toAiPlanSubmitPayload({
    ...EMPTY_AI_PLAN_FORM_VALUES,
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    petIds: ['1234567890123456789'],
  })

  expect('planId' in payload).toBe(false)
  expect('regenerateDay' in payload).toBe(false)
})
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/submit.test.ts`
Expected: FAIL — `petIds` 가 `AiPlanFormValues` 에 없어 타입/런타임 모두 어긋난다

- **Step 3: 타입을 바꾼다**

`src/types/ai-plan.ts` — `AiPlanSubmitPayload` 의 `petId: string` 을 지우고:

```ts
  /**
   * 동반 반려견. **한 마리여도 배열이다** (#128 · 명세 D2-2).
   *
   * 서버가 `petIds` 를 `petId` 보다 우선하므로(`effectivePetIds()`) 결과가 같고,
   * 두 경로를 남기면 제출·스냅샷·복원 세 곳에 각각 분기가 생긴다.
   */
  petIds: string[]
```

같은 파일의 `AiPlanFormValues` 에서도 `petId: string` → `petIds: string[]`,
`EMPTY_AI_PLAN_FORM_VALUES` 에서 `petId: ''` → `petIds: []`.

- **Step 4: 문구를 추가한다**

`src/lib/messages/ai-plan.ts` 의 `errorPinnedTooMany` 근처에:

```ts
  /** 반려견 상한(5) 2차 방어. 화면이 만들 수 없는 상태라 실제로는 닿지 않는다 */
  errorPetTooMany: '반려견은 최대 5마리까지 고를 수 있어요.',
```

- **Step 5: 스키마를 바꾼다**

`src/features/ai-plan/schemas.ts` — `MAX_PET_COUNT` 를 import 하고 `petId` 항목을 교체:

```ts
    /**
     * AIPLAN_105. 체크박스가 값을 고정하므로 실질적으로는 2차 방어다.
     *
     * **서버는 반려견을 선택으로 받는다**(없으면 대표 반려견)지만 화면은 필수로 둔다 —
     * 어느 아이 기준으로 짠 일정인지 사용자가 알아야 결과를 판단할 수 있다.
     *
     * 상한은 백엔드 `@Size(max = 5)` 와 회원당 반려견 상한이 같은 값이라 후자를 쓴다 —
     * 숫자를 새로 적지 않는다 (#128).
     */
    petIds: z
      .array(z.string().min(1))
      .min(1, messages.aiPlan.errorPetRequired)
      .max(MAX_PET_COUNT, messages.aiPlan.errorPetTooMany),
```

import 추가: `import { MAX_PET_COUNT } from '@/lib/api/pet'`

- **Step 6: 제출부를 바꾼다**

`src/lib/ai-plan/submit.ts` — 반환 객체의 `petId: values.petId,` 를 `petIds: values.petIds,` 로 바꾸고, JSDoc 의 두 줄을 교체:

```
 * - **`petId` 를 숫자로 바꾸지 않는다.** Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다
```

→

```
 * - **`petIds` 를 숫자로 바꾸지 않는다.** Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다
 *   (plan 공통명세 S1). **한 마리여도 배열로 보낸다** — 서버가 `petIds` 를 우선하므로
 *   결과가 같고, 두 경로를 남기면 분기가 세 곳에 생긴다 (다견선택-세부명세 D2-2)
```

```
 * - **`petIds`·`planId`·`regenerateDay` 는 아직 보내지 않는다.** 이유는
 *   `types/ai-plan.ts` 주석 — 앞은 `POST /plans` 가 `petId` 단일이라, 뒤는 아트보드와
 *   계약이 어긋나 있어서다
```

→

```
 * - **`planId`·`regenerateDay` 는 아직 보내지 않는다.** 아트보드와 계약이 어긋나 있다 (#90)
```

- **Step 7: 통과를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/submit.test.ts`
Expected: PASS

- **Step 8: 커밋**

```bash
git add src/types/ai-plan.ts src/features/ai-plan/schemas.ts src/lib/ai-plan/submit.ts src/lib/messages/ai-plan.ts src/lib/ai-plan/submit.test.ts
git commit -m "$(cat <<'EOF'
[FE] feat: AI 일정 제출 본문을 petIds 배열로 바꾼다

한 마리여도 배열로 보낸다 — 서버 effectivePetIds() 가 petIds 를 우선해
결과가 같고, 두 경로를 남기면 제출·스냅샷·복원 세 곳에 분기가 생긴다.

submit.test.ts 의 "petIds 가 새어 나가지 않는다" 잠금은 의도적으로 뒤집는다.
그 테스트는 미완성 필드가 새는 것을 막으려던 것이고, planId·regenerateDay 는
여전히 미완성이라 그대로 잠가 둔다 (#90).

Issue Number: #128
EOF
)"
```

---

### Task 2: 스냅샷을 `pets[]` 로 바꾸고 옛 모양을 승격한다

**Files:**

- Modify: `src/types/ai-plan.ts` (`AiPlanRequestSnapshot`)
- Modify: `src/lib/ai-plan/request-store.ts` (`toSnapshot`)
- Test: `src/lib/ai-plan/request-store.test.ts`

**Interfaces:**

- Consumes: Task 1 의 `AiPlanSubmitPayload.petIds`
- Produces: `AiPlanRequestSnapshot.pets: { petId: string; name: string }[]`

- **Step 1: 실패하는 테스트를 쓴다**

`src/lib/ai-plan/request-store.test.ts` 에 추가한다. 기존 `petId`/`petName` 을 쓰는 테스트는 새 모양으로 고친다.

```ts
it('새 모양을 저장하고 읽는다', () => {
  saveAiPlanRequest('job-1', {
    areaCode: '39',
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    pets: [
      { petId: '1', name: '몽실이' },
      { petId: '2', name: '초코' },
    ],
    budget: null,
    requestNote: '',
  })

  expect(readAiPlanRequest('job-1')?.pets).toEqual([
    { petId: '1', name: '몽실이' },
    { petId: '2', name: '초코' },
  ])
})

/**
 * 배포 직후 대기 화면에 있던 사용자를 막지 않기 위한 승격이다 (명세 D2-3).
 * 승격이 없으면 readAiPlanRequest 가 null 을 주고 담기가 막힌다.
 */
it('옛 모양(petId·petName)을 한 마리 배열로 승격해 읽는다', () => {
  globalThis.sessionStorage.setItem(
    'hondigagae.ai-plan.request.job-old',
    JSON.stringify({
      areaCode: '39',
      startDate: '2026-09-11',
      endDate: '2026-09-13',
      petId: '1234567890123456789',
      petName: '몽실이',
      budget: null,
      requestNote: '',
    }),
  )

  expect(readAiPlanRequest('job-old')?.pets).toEqual([
    { petId: '1234567890123456789', name: '몽실이' },
  ])
})

it('옛 모양에 이름이 없어도 승격한다 — 이름은 제목 기본값에만 쓰인다', () => {
  globalThis.sessionStorage.setItem(
    'hondigagae.ai-plan.request.job-noname',
    JSON.stringify({
      areaCode: '39',
      startDate: '2026-09-11',
      endDate: '2026-09-13',
      petId: '1234567890123456789',
      budget: null,
      requestNote: '',
    }),
  )

  expect(readAiPlanRequest('job-noname')?.pets).toEqual([
    { petId: '1234567890123456789', name: '' },
  ])
})

it('반려견이 하나도 없으면 null 이다 — 담기에 쓸 수 없는 조건이다', () => {
  globalThis.sessionStorage.setItem(
    'hondigagae.ai-plan.request.job-empty',
    JSON.stringify({
      areaCode: '39',
      startDate: '2026-09-11',
      endDate: '2026-09-13',
      pets: [],
      budget: null,
      requestNote: '',
    }),
  )

  expect(readAiPlanRequest('job-empty')).toBeNull()
})
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/request-store.test.ts`
Expected: FAIL — `pets` 가 타입에 없고 `toSnapshot` 이 새 모양을 거부한다

- **Step 3: 타입을 바꾼다**

`src/types/ai-plan.ts` 의 `AiPlanRequestSnapshot` 에서 `petId: string` 과 `petName: string` 을 지우고:

```ts
/**
 * 동반 반려견. **담기에는 이 중 한 마리만 실린다** — `PlanCreateRequest.petId` 가
 * 단일이라 담기 패널에서 판정 기준을 고른다 (명세 D4).
 *
 * `name` 은 일정 제목 기본값에만 쓰인다. 비어 있어도 흐름이 막히지 않는다.
 */
pets: {
  petId: string
  name: string
}
;[]
```

- **Step 4: 승격 로직을 넣는다**

`src/lib/ai-plan/request-store.ts` 의 `toSnapshot` 에서 `petId` 줄과 반환문을 교체한다:

```ts
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
```

- **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/request-store.test.ts`
Expected: PASS

- **Step 6: 커밋**

```bash
git add src/types/ai-plan.ts src/lib/ai-plan/request-store.ts src/lib/ai-plan/request-store.test.ts
git commit -m "$(cat <<'EOF'
[FE] feat: AI 일정 조건 스냅샷을 pets 배열로 바꾸고 옛 모양을 승격한다

sessionStorage 에 {petId, petName} 으로 남아 있는 진행 중인 작업이 있다.
새 모양만 받으면 readAiPlanRequest 가 null 을 주고 배포 직후 대기 화면에
있던 사용자가 담기를 못 한다. 읽기에서만 한 마리 배열로 승격한다 —
쓰기는 항상 새 모양이라 양방향 호환을 만들지 않는다.

Issue Number: #128
EOF
)"
```

---

### Task 3: 담기 페이로드가 기준 `petId` 를 인자로 받는다

**Files:**

- Modify: `src/lib/ai-plan/draft-to-plan.ts`
- Test: `src/lib/ai-plan/draft-to-plan.test.ts`

**Interfaces:**

- Consumes: Task 2 의 `AiPlanRequestSnapshot.pets`
- Produces: `draftToPlanPayload({ draft, snapshot, basisPetId, title, totalDays, excludedPlaceIds })` — `basisPetId: string` 이 새 필수 옵션이다

- **Step 1: 실패하는 테스트를 쓴다**

`src/lib/ai-plan/draft-to-plan.test.ts` — 기존 호출에 `basisPetId` 를 넣고 아래를 추가한다.

```ts
it('기준으로 고른 반려견이 페이로드에 실린다', () => {
  const payload = draftToPlanPayload({
    draft,
    snapshot: {
      ...snapshot,
      pets: [
        { petId: '111', name: '몽실이' },
        { petId: '222', name: '초코' },
      ],
    },
    basisPetId: '222',
    title: '제주 2박 3일',
    totalDays: 3,
  })

  expect(payload.petId).toBe('222')
})

it('스냅샷의 다른 아이가 실리지 않는다 — 첫 번째를 기본으로 삼지 않는다', () => {
  const payload = draftToPlanPayload({
    draft,
    snapshot: {
      ...snapshot,
      pets: [
        { petId: '111', name: '몽실이' },
        { petId: '222', name: '초코' },
      ],
    },
    basisPetId: '222',
    title: '제주 2박 3일',
    totalDays: 3,
  })

  expect(payload.petId).not.toBe('111')
})
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/draft-to-plan.test.ts`
Expected: FAIL — `basisPetId` 가 옵션 타입에 없다

- **Step 3: 옵션과 매핑을 바꾼다**

`src/lib/ai-plan/draft-to-plan.ts` — `DraftToPlanOptions` 에 추가:

```ts
/**
 * 이 일정의 판정 기준이 될 반려견. **스냅샷에서 꺼내지 않고 받는다** —
 * `PlanCreateRequest.petId` 가 단일이라 여러 마리 중 하나를 사람이 고르고
 * (명세 D4), 그 선택이 여기까지 그대로 와야 한다.
 */
basisPetId: string
```

반환문의 `petId: snapshot.petId,` → `petId: basisPetId,`, 구조분해에 `basisPetId` 추가.

- **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/draft-to-plan.test.ts`
Expected: PASS

- **Step 5: 커밋**

```bash
git add src/lib/ai-plan/draft-to-plan.ts src/lib/ai-plan/draft-to-plan.test.ts
git commit -m "$(cat <<'EOF'
[FE] refactor: 담기 페이로드가 기준 반려견을 인자로 받는다

PlanCreateRequest.petId 가 단일이라 여러 마리 중 하나를 사람이 고른다.
스냅샷에서 첫 번째를 꺼내면 그 선택이 조용히 무시된다.

Issue Number: #128
EOF
)"
```

---

### Task 4: 반려견 이름 이어붙이기

**Files:**

- Create: `src/lib/ai-plan/pet-names.ts`
- Test: `src/lib/ai-plan/pet-names.test.ts`

**Interfaces:**

- Consumes: Task 2 의 `pets` 모양
- Produces: `petNamesLabel(pets: { name: string }[]): string`

- **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'

import { petNamesLabel } from '@/lib/ai-plan/pet-names'
import { defaultPlanTitle } from '@/lib/ai-plan/draft-title'

describe('petNamesLabel — 이름을 이어 붙인다', () => {
  it('한 마리면 그대로다', () => {
    expect(petNamesLabel([{ name: '몽실이' }])).toBe('몽실이')
  })

  it('여러 마리는 · 로 잇는다', () => {
    expect(petNamesLabel([{ name: '몽실이' }, { name: '초코' }])).toBe('몽실이·초코')
  })

  it('빈 이름은 건너뛴다 — 구분자만 남지 않는다', () => {
    expect(petNamesLabel([{ name: '몽실이' }, { name: '' }])).toBe('몽실이')
  })

  it('전부 비면 빈 문자열이다', () => {
    expect(petNamesLabel([{ name: '' }, { name: '' }])).toBe('')
  })
})

/**
 * 조사 로직을 복제하지 않는다는 것을 잠근다 — withCompanionParticle 이
 * **마지막 글자**의 받침을 보므로 이어붙인 문자열을 그대로 넘기면 맞는다 (명세 D5).
 */
describe('이어붙인 이름 + 제목 기본값', () => {
  it('마지막 이름에 받침이 없으면 와', () => {
    expect(defaultPlanTitle(petNamesLabel([{ name: '몽실이' }, { name: '초코' }]), 3)).toContain(
      '몽실이·초코와',
    )
  })

  it('마지막 이름에 받침이 있으면 과', () => {
    expect(defaultPlanTitle(petNamesLabel([{ name: '초코' }, { name: '곰' }]), 3)).toContain(
      '초코·곰과',
    )
  })
})
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/pet-names.test.ts`
Expected: FAIL — 모듈이 없다

- **Step 3: 구현한다**

`src/lib/ai-plan/pet-names.ts`:

```ts
/** 여러 마리의 이름을 한 줄로 잇는다 — 제목 기본값과 요약 줄이 함께 쓴다 (#128) */

/**
 * `몽실이·초코`.
 *
 * **조사를 여기서 붙이지 않는다.** `defaultPlanTitle` 이 쓰는
 * `withCompanionParticle` 은 **마지막 글자**의 받침을 보므로 이어붙인 문자열을 그대로
 * 넘기면 `몽실이·초코와` 가 나온다 — 조사 로직을 복제하지 않는다 (명세 D5).
 *
 * 빈 이름은 건너뛴다. 스냅샷의 `name` 은 비어 있을 수 있고(옛 모양 승격),
 * 그대로 이으면 `몽실이·` 처럼 구분자만 남는다.
 */
export function petNamesLabel(pets: { name: string }[]): string {
  return pets
    .map((pet) => pet.name.trim())
    .filter((name) => name !== '')
    .join('·')
}
```

- **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/lib/ai-plan/pet-names.test.ts`
Expected: PASS

- **Step 5: 커밋**

```bash
git add src/lib/ai-plan/pet-names.ts src/lib/ai-plan/pet-names.test.ts
git commit -m "$(cat <<'EOF'
[FE] feat: 반려견 이름 이어붙이기 (petNamesLabel)

조사는 붙이지 않는다. withCompanionParticle 이 마지막 글자의 받침을 보므로
이어붙인 문자열을 그대로 넘기면 "몽실이·초코와" 가 나온다 — 조사 로직을
복제하지 않는다.

Issue Number: #128
EOF
)"
```

---

### Task 5: `PetCheckboxGroup` 컴포넌트

**Files:**

- Create: `src/features/ai-plan/pet-checkbox-group.tsx`
- Test: `src/features/ai-plan/pet-checkbox-group.test.ts`

**Interfaces:**

- Consumes: 없음
- Produces: `<PetCheckboxGroup id label options={{value,label,description}[]} values={string[]} onValuesChange={(v:string[])=>void} error? required? />`

**참고:** `src/components/radio-group.tsx` 를 열어 마크업을 그대로 본뜬다 — `<fieldset>` + `<legend>`, `fieldErrorId(id)` 공유, 44px(`min-h-11`), 선택 시 `border-fg bg-row-selected`, `aria-invalid` 는 fieldset 에만. **`src/components/` 에 두지 않는다** (`component-guide.md` §9 — 1곳이면 feature 안).

- **Step 1: 실패하는 테스트를 쓴다**

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PetCheckboxGroup } from '@/features/ai-plan/pet-checkbox-group'
import { fieldErrorId } from '@/lib/form/field-errors'

const OPTIONS = [
  { value: '1', label: '몽실이', description: '말티즈 · 소형견' },
  { value: '2', label: '초코', description: '리트리버 · 대형견' },
]

function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PetCheckboxGroup, {
      id: 'petIds',
      label: '함께 갈 반려견',
      options: OPTIONS,
      values: [],
      onValuesChange: () => undefined,
      ...overrides,
    }),
  )
}

describe('PetCheckboxGroup — 여러 마리를 고른다', () => {
  it('반려견 수만큼 체크박스가 나온다', () => {
    const markup = render()

    expect(markup.split('type="checkbox"').length - 1).toBe(2)
    expect(markup).toContain('몽실이')
    expect(markup).toContain('초코')
  })

  it('여러 개가 동시에 체크된다 — 라디오가 아니다', () => {
    const markup = render({ values: ['1', '2'] })

    expect(markup.split('checked=""').length - 1).toBe(2)
  })

  it('고르지 않은 항목은 체크되지 않는다', () => {
    expect(render({ values: ['1'] }).split('checked=""').length - 1).toBe(1)
  })

  it('선택의 근거인 description 을 숨기지 않는다', () => {
    expect(render()).toContain('말티즈 · 소형견')
  })
})

describe('오류 배선 — RadioGroup 과 같다', () => {
  it('오류는 fieldset 에 aria-invalid 와 aria-describedby 로 붙는다', () => {
    const markup = render({ error: '반려견을 골라 주세요.' })

    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain(`aria-describedby="${fieldErrorId('petIds')}"`)
    expect(markup).toContain('반려견을 골라 주세요.')
  })

  it('오류가 없으면 그 속성들이 없다', () => {
    const markup = render()

    expect(markup).not.toContain('aria-invalid')
    expect(markup).not.toContain('aria-describedby')
  })

  it('그룹 라벨은 legend 다 — 체크박스 그룹은 labelable 이 아니다', () => {
    expect(render()).toContain('<legend')
  })
})
```

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/pet-checkbox-group.test.ts`
Expected: FAIL — 모듈이 없다

- **Step 3: 구현한다**

`src/components/radio-group.tsx` 를 읽고 그 구조를 본떠 작성한다. 오류 문구 렌더 부분(파일 하단)도 그대로 맞춘다.

```tsx
'use client'

import { fieldErrorId } from '@/lib/form/field-errors'
import { cn } from '@/lib/utils/cn'

export type PetCheckboxOption = {
  value: string
  label: string
  description?: string | null
}

export type PetCheckboxGroupProps = {
  id: string
  label: string
  options: readonly PetCheckboxOption[]
  values: readonly string[]
  onValuesChange: (values: string[]) => void
  error?: string | undefined
  required?: boolean
  className?: string
}

/**
 * 다중 선택 그룹 — 아트보드 01 의 반려견 선택 (#128).
 *
 * **`RadioGroup` 을 그대로 본떴다.** `<fieldset>` + `<legend>` · `fieldErrorId()` 공유 ·
 * 44px 터치 영역 · 선택 틴트 · `aria-invalid` 를 fieldset 에만 두는 것까지 같다
 * (component-guide.md §7).
 *
 * **`src/components/` 에 두지 않는다.** 사용처가 하나라 §9 가 feature 안에 두라고 정했다.
 * 두 번째 사용처가 생기면 승격하고 `pet` 을 이름에서 뗀다.
 *
 * **`RadioGroup` 을 확장하지 않은 이유**: 단일/다중은 `value: T` ↔ `values: T[]` 로 타입이
 * 갈리고 `name` 공유·키보드 이동 규칙이 다르다. optional prop 하나로 겸하게 만들면
 * §9 의 "기본 동작을 바꾸는 변경" 이 된다.
 *
 * controlled 전용이다 (component-guide.md §5).
 */
export function PetCheckboxGroup({
  id,
  label,
  options,
  values,
  onValuesChange,
  error,
  required = false,
  className,
}: PetCheckboxGroupProps) {
  const invalid = error !== undefined

  function toggle(value: string): void {
    onValuesChange(
      values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
    )
  }

  return (
    <fieldset
      className={cn('flex flex-col gap-1', className)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={invalid ? fieldErrorId(id) : undefined}
    >
      <legend className="text-body-2 text-fg mb-1 font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-500 ml-1">
            *
          </span>
        )}
      </legend>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const optionId = `${id}-${option.value}`
          const checked = values.includes(option.value)

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2',
                'focus-within:ring-brand-500 focus-within:ring-2 focus-within:ring-offset-1',
                checked ? 'border-fg bg-row-selected' : 'border-border-strong',
                invalid && 'border-danger-500',
              )}
            >
              <input
                type="checkbox"
                id={optionId}
                name={id}
                value={option.value}
                checked={checked}
                onChange={() => toggle(option.value)}
                className="accent-brand-600 mt-0.5 size-5 shrink-0"
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-body-2 text-fg font-medium">{option.label}</span>
                {option.description !== null && option.description !== undefined && (
                  <span className="text-caption text-fg-muted">{option.description}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>

      {invalid && (
        <p id={fieldErrorId(id)} className="text-caption text-danger-700 mt-1">
          {error}
        </p>
      )}
    </fieldset>
  )
}
```

> `RadioGroup` 의 실제 오류 문구 마크업(클래스·`role`)이 위와 다르면 **그쪽에 맞춘다.**
> 두 그룹의 오류 표현이 갈리면 같은 폼에서 두 모양이 보인다.

- **Step 4: 통과를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/pet-checkbox-group.test.ts`
Expected: PASS

- **Step 5: 커밋**

```bash
git add src/features/ai-plan/pet-checkbox-group.tsx src/features/ai-plan/pet-checkbox-group.test.ts
git commit -m "$(cat <<'EOF'
[FE] feat: 반려견 다중 선택 그룹 (PetCheckboxGroup)

components/checkbox.tsx 는 단일 체크박스라 그룹 시맨틱이 없다. RadioGroup 의
fieldset+legend·fieldErrorId 공유·44px·선택 틴트를 폼 파일에 베끼면 오류 배선
규칙이 두 벌이 되므로 그룹 컴포넌트로 만든다.

사용처가 하나라 component-guide.md §9 에 따라 feature 안에 둔다.

Issue Number: #128
EOF
)"
```

---

### Task 6: 조건 입력 화면 배선

**Files:**

- Modify: `src/features/ai-plan/ai-plan-create-form.tsx` (`RadioGroup` → `PetCheckboxGroup`)
- Modify: `src/features/ai-plan/ai-plan-create-view.tsx` (초기값 · 복원 · 스냅샷 저장)
- Test: `src/features/ai-plan/ai-plan-create-form.test.ts`

**Interfaces:**

- Consumes: Task 1 (`petIds`) · Task 2 (`pets`) · Task 5 (`PetCheckboxGroup`)
- Produces: 없음 (화면 배선)

- **Step 1: 실패하는 테스트를 쓴다**

`src/features/ai-plan/ai-plan-create-form.test.ts` 에 추가하고, 기존 `petId` 를 쓰는 렌더 헬퍼를 `petIds: []` 로 고친다.

```ts
it('반려견을 체크박스로 고른다 — 라디오가 아니다', () => {
  const markup = render()

  expect(markup).toContain('type="checkbox"')
  expect(markup).not.toContain('type="radio"')
})

it('여러 마리가 동시에 선택된 상태로 렌더된다', () => {
  const markup = render({
    values: { ...BASE_VALUES, petIds: ['1', '2'] },
  })

  expect(markup.split('checked=""').length - 1).toBeGreaterThanOrEqual(2)
})
```

> `BASE_VALUES` · `render` 의 실제 이름은 기존 파일을 열어 확인하고 맞춘다.

- **Step 2: 실패를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/ai-plan-create-form.test.ts`
Expected: FAIL — 아직 `RadioGroup` 이라 `type="radio"` 가 나온다

- **Step 3: 폼 컨트롤을 바꾼다**

`src/features/ai-plan/ai-plan-create-form.tsx` — `RadioGroup` 블록을 교체:

```tsx
<PetCheckboxGroup
  id="petIds"
  label={messages.aiPlan.fieldPet}
  required
  options={pets.map((pet) => ({
    value: pet.petId,
    label: pet.name,
    description: describePet(pet),
  }))}
  values={values.petIds}
  onValuesChange={(petIds) => onValueChange('petIds', petIds)}
  error={errors.fields.petIds}
/>
```

`RadioGroup` import 가 이 파일에서 더 쓰이지 않으면 지운다.

- **Step 4: 초기값·복원·저장을 바꾼다**

`src/features/ai-plan/ai-plan-create-view.tsx`:

`restoreValues` 의 `base` 와 복원부:

```ts
const base: AiPlanFormValues = {
  ...EMPTY_AI_PLAN_FORM_VALUES,
  // 한 마리뿐이면 미리 고른다 — 고를 것이 없는 그룹을 비워 두지 않는다
  petIds: pets.length === 1 ? [pets[0]?.petId ?? ''].filter((id) => id !== '') : [],
}
```

```ts
/*
    **삭제된 반려견은 걸러 낸다.** 그 사이 지웠을 수 있고, 없는 아이가 선택된 채로
    남으면 제출이 서버에서 막힌다. 전부 사라졌으면 base(빈 배열)로 떨어진다.
  */
const knownPetIds = snapshot.pets
  .map((pet) => pet.petId)
  .filter((petId) => pets.some((pet) => pet.petId === petId))

return {
  requestNote: snapshot.requestNote,
  startDate: snapshot.startDate,
  endDate: snapshot.endDate,
  petIds: knownPetIds.length > 0 ? knownPetIds : base.petIds,
  budgetManwon: toBudgetManwon(snapshot.budget),
  preferFavorites: snapshot.preferFavorites ?? false,
  pinnedPlaces: snapshot.pinnedPlaces ?? [],
}
```

스냅샷 저장부(`saveAiPlanRequest` 호출)에서 `petId`/`petName` 두 줄을 교체:

```ts
        pets: payload.petIds.map((petId) => ({
          petId,
          name: pets.find((pet) => pet.petId === petId)?.name ?? '',
        })),
```

- **Step 5: 통과를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/`
Expected: PASS

- **Step 6: 전체 게이트**

Run: `pnpm verify`
Expected: PASS. 실패하면 남은 `petId` 참조를 `rg "values\.petId\b|snapshot\.petId\b|petName" src/` 로 찾아 고친다.

- **Step 7: 커밋**

```bash
git add src/features/ai-plan/ai-plan-create-form.tsx src/features/ai-plan/ai-plan-create-view.tsx src/features/ai-plan/ai-plan-create-form.test.ts
git commit -m "$(cat <<'EOF'
[FE] feat: AI 일정 조건 입력에서 반려견을 여러 마리 고른다

라디오를 체크박스 그룹으로 바꾼다. 한 마리뿐인 회원은 지금처럼 자동 선택돼
화면이 사실상 그대로다.

복원할 때 삭제된 반려견을 걸러 낸다 — 없는 아이가 선택된 채로 남으면
제출이 서버에서 막힌다.

Issue Number: #128
EOF
)"
```

---

### Task 7: 담기 패널의 판정 기준 선택

**Files:**

- Modify: `src/features/ai-plan/ai-plan-commit-panel.tsx`
- Modify: `src/features/ai-plan/ai-plan-job-view.tsx`
- Modify: `src/lib/messages/ai-plan.ts` (문구 2개)
- Test: `src/features/ai-plan/ai-plan-commit-panel.test.ts`

**Interfaces:**

- Consumes: Task 2 (`pets`) · Task 3 (`basisPetId`) · Task 4 (`petNamesLabel`)
- Produces: `AiPlanCommitPanelProps` 에 `basisOptions: {value,label}[]` · `basisPetId: string` · `onBasisPetIdChange: (petId: string) => void`

- **Step 1: 문구를 추가한다**

`src/lib/messages/ai-plan.ts`:

```ts
  /** 담기 패널의 판정 기준 선택 (#128). **2마리 이상일 때만 보인다** */
  commitBasisLabel: '판정 기준 반려견',
  /** 무엇이 걸린 선택인지 말한다 — 저장 후 판정이 이 아이 기준이 된다 */
  commitBasisHint: '저장한 뒤 날씨·산책 판정은 고른 아이 기준으로 나와요.',
```

- **Step 2: 실패하는 테스트를 쓴다**

`src/features/ai-plan/ai-plan-commit-panel.test.ts` — `BASE` 에 아래를 넣고(한 마리 기본) 테스트를 추가한다.

```ts
// BASE 에 추가
  basisOptions: [{ value: '1', label: '몽실이' }],
  basisPetId: '1',
  onBasisPetIdChange: () => undefined,
```

```ts
describe('판정 기준 선택 — 두 마리 이상일 때만 (#128)', () => {
  const TWO = [
    { value: '1', label: '몽실이' },
    { value: '2', label: '초코' },
  ]

  it('한 마리면 렌더하지 않는다 — 지금 화면과 같다', () => {
    const markup = render()

    expect(markup).not.toContain(messages.aiPlan.commitBasisLabel)
    expect(markup).not.toContain('type="radio"')
  })

  it('두 마리 이상이면 라디오로 고른다', () => {
    const markup = render({ basisOptions: TWO, basisPetId: '1' })

    expect(markup).toContain(messages.aiPlan.commitBasisLabel)
    expect(markup.split('type="radio"').length - 1).toBe(2)
  })

  it('무엇이 걸린 선택인지 말한다', () => {
    expect(render({ basisOptions: TWO, basisPetId: '1' })).toContain(
      messages.aiPlan.commitBasisHint,
    )
  })

  it('고른 아이가 선택된 채로 렌더된다', () => {
    const markup = render({ basisOptions: TWO, basisPetId: '2' })

    expect(markup.split('checked=""').length - 1).toBe(1)
    expect(markup).toContain('초코')
  })
})
```

- **Step 3: 실패를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/ai-plan-commit-panel.test.ts`
Expected: FAIL — props 가 없다

- **Step 4: 패널에 컨트롤을 넣는다**

`src/features/ai-plan/ai-plan-commit-panel.tsx` — `AiPlanCommitPanelProps` 에 추가:

```ts
  /**
   * 판정 기준 후보. **두 마리 이상일 때만 컨트롤이 나타난다** (#128 · 명세 D4).
   *
   * `PlanCreateRequest.petId` 가 단일이라 여러 마리로 만든 초안도 저장은 한 마리에
   * 붙는다. 자동으로 고르지 않는 이유는 명세 D0 — 프롬프트의 "가장 제약이 큰 아이" 는
   * 입장 제한 축이고 날씨 판정은 민감도 축이라 서로 다르다.
   */
  basisOptions: readonly { value: string; label: string }[]
  basisPetId: string
  onBasisPetIdChange: (petId: string) => void
```

제목 입력 아래·담기 버튼 위에 렌더한다:

```tsx
{
  basisOptions.length >= 2 && (
    <div className="flex flex-col gap-1">
      <RadioGroup
        id="basisPetId"
        label={messages.aiPlan.commitBasisLabel}
        options={basisOptions}
        value={basisPetId}
        onValueChange={onBasisPetIdChange}
      />
      <p className="text-caption text-fg-muted">{messages.aiPlan.commitBasisHint}</p>
    </div>
  )
}
```

`RadioGroup` import 를 추가한다.

- **Step 5: job-view 를 배선한다**

`src/features/ai-plan/ai-plan-job-view.tsx`:

기준 상태를 만든다. 기본값은 **스냅샷 `pets` 의 첫 번째 = 먼저 고른 아이**다 (명세 D4).

**`usePetList()` 를 붙이지 않는다.** 이 화면은 반려견 목록을 갖고 있지 않고(실측 확인),
기본값 하나를 위해 데이터 의존을 늘리면 조회가 늦거나 실패할 때 기본값이 흔들린다.

```ts
/*
    판정 기준 반려견 (#128 · 명세 D4). 기본값은 **먼저 고른 아이**다 —
    `pets` 순서가 체크한 순서다.

    **스냅샷이 없으면 빈 문자열이고, 그때는 담기 자체가 막혀 있다** (조건 부재 경로).
  */
const [basisPetId, setBasisPetId] = useState('')

useEffect(() => {
  if (snapshot === null || basisPetId !== '') return
  setBasisPetId(snapshot.pets[0]?.petId ?? '')
}, [snapshot, basisPetId])
```

`defaultPlanTitle(snapshot.petName, …)` 호출을 `defaultPlanTitle(petNamesLabel(snapshot.pets), …)` 로,
요약 줄의 `if (snapshot.petName !== '') parts.push(snapshot.petName)` 을
`const names = petNamesLabel(snapshot.pets); if (names !== '') parts.push(names)` 로 바꾼다.

`draftToPlanPayload({ … })` 호출에 `basisPetId` 를 넘긴다.

`AiPlanCommitPanel` 에 세 props 를 넘긴다:

```tsx
            basisOptions={snapshot.pets.map((pet) => ({ value: pet.petId, label: pet.name }))}
            basisPetId={basisPetId}
            onBasisPetIdChange={setBasisPetId}
```

- **Step 6: 통과를 확인한다**

Run: `pnpm vitest run src/features/ai-plan/`
Expected: PASS — 기존 `delistedBlocked` 분기 테스트도 함께 통과해야 한다

- **Step 7: 전체 게이트**

Run: `pnpm verify && pnpm format:check`
Expected: PASS

- **Step 8: 커밋**

```bash
git add src/features/ai-plan/ai-plan-commit-panel.tsx src/features/ai-plan/ai-plan-job-view.tsx src/lib/messages/ai-plan.ts src/features/ai-plan/ai-plan-commit-panel.test.ts
git commit -m "$(cat <<'EOF'
[FE] feat: 담기 직전에 판정 기준 반려견을 고른다

PlanCreateRequest.petId 가 단일이라 여러 마리로 만든 초안도 저장은 한 마리에
붙는다. 자동으로 고르지 않는다 — 프롬프트의 "가장 제약이 큰 아이" 는 입장
제한(크기·체중) 축이고 저장 후 날씨 판정은 민감도(더위·추위) 축이라, 가장 큰
아이가 더위에 가장 약한 아이라는 보장이 없다.

한 마리면 컨트롤을 렌더하지 않아 기존 화면과 같다.

Issue Number: #128
EOF
)"
```

---

### Task 8: 브라우저 실측과 문서 갱신

**Files:**

- Modify: `frontend/docs/features/ai-plan/공통명세.md` (S1 · S2 · S8)
- Modify: `frontend/docs/screen-inventory.md` (§5 — 258행 근처 "#84 는 단일 `petId` 만 보낸다")
- Modify: `frontend/src/lib/api/mock/ai-plan-data.ts` (필요 시 — mock 이 `petId` 를 읽고 있으면)

**Interfaces:**

- Consumes: Task 1–7 전부
- Produces: 없음

- **Step 1: mock 이 새 본문을 받는지 확인한다**

Run: `rg "petId" src/lib/api/mock/ai-plan-data.ts`
`petId` 를 읽는 곳이 있으면 `petIds` 로 고친다. 없으면 다음 단계로.

- **Step 2: 브라우저로 확인한다**

```bash
cd frontend && ./node_modules/.bin/next dev -p 5176
```

`MOCK_API=true` 상태에서 `demo@hondigagae.dev` / `password123!` 로 로그인하고
`/ai-plans/new` 로 간다. 확인할 것:

1. 반려견이 체크박스로 나오고 **두 마리를 동시에 고를 수 있다**
2. 제출 → 대기 화면 → 초안이 나온다
3. 담기 패널에 **판정 기준 라디오**가 있고 문구가 함께 있다
4. 제목 기본값이 `몽실이·초코와 제주 …` 다
5. **한 마리만 고르면** 담기 패널에 기준 라디오가 **없다**
6. 콘솔에 이 변경으로 생긴 오류가 없다 (HMR 웹소켓 경고는 무관)

- **Step 3: 옛 스냅샷 승격을 실측한다**

브라우저 콘솔에서 옛 모양을 심고 그 `jobId` 의 대기 화면을 연다:

```js
sessionStorage.setItem(
  'hondigagae.ai-plan.request.<jobId>',
  JSON.stringify({
    areaCode: '39',
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    petId: '<실제 petId>',
    petName: '몽실이',
    budget: null,
    requestNote: '',
  }),
)
```

담기가 막히지 않고 제목 기본값에 `몽실이` 가 들어가면 통과다.

- **Step 4: 문서를 고친다**

- `공통명세.md` S1 — 계약 표의 반려견 항목을 `petIds`(배열, 최대 5) 로. S2 — 화면 범위에서 다중 반려견을 "구현" 으로. S8 — 미결에서 다중 반려견 항목을 정리하고 **저장이 여전히 단일이라는 사실**을 남긴다.
- `screen-inventory.md` §5 — "**#84 는 단일 `petId` 만 보낸다**" 를 현재 상태로 고치고, 저장이 단일이라는 제약과 `다견선택-세부명세.md` 링크를 건다.

- **Step 5: 게이트**

Run: `pnpm verify && pnpm format:check`
Expected: PASS

- **Step 6: 커밋**

```bash
git add -A frontend/
git commit -m "$(cat <<'EOF'
[DOCS] docs: 다중 반려견 구현을 명세·인벤토리에 반영

Issue Number: #128
EOF
)"
```

- **Step 7: PR 과 이슈**

`/pr` 스킬로 본문을 만들고 PR 을 연다 (base `develop`, assignee `@me`).
**본문에 반드시 적을 것**: 아트보드 이탈(라디오→체크박스)과 그 근거, 저장이 여전히
단일이라는 제약, 브라우저 실측 결과(Step 2·3), `submit.test.ts` 잠금을 뒤집은 이유.

**#128 은 닫지 않는다** — 하루 재생성이 남는다. 다중 반려견 체크박스만 체크하고,
남은 항목과 `PlanCreateRequest.petIds` BE 선행이 여전히 추적 이슈 없이 남아 있음을
코멘트로 갱신한다.

---

## Self-Review

**1. Spec coverage**

| 명세                             | 태스크                                             |
| -------------------------------- | -------------------------------------------------- |
| D2-1 타입 4곳                    | 1(폼·제출) · 2(스냅샷) · 3(`draftToPlanPayload`)   |
| D2-2 `petIds` 통일 · 잠금 뒤집기 | 1                                                  |
| D2-3 옛 스냅샷 승격              | 2                                                  |
| D3-1 `PetCheckboxGroup` 배치     | 5                                                  |
| D3-2 상한·하한·1마리 자동 선택   | 1(스키마) · 6(초기값)                              |
| D4 담기 기준 선택                | 7                                                  |
| D5 문구·조사                     | 4 · 7                                              |
| D6 경계 3가지                    | 2(옛 스냅샷) · 6(삭제된 반려견) · 7(기본값 재계산) |
| D7 테스트                        | 1–7 각 태스크                                      |
| D10 문서 갱신                    | 8                                                  |

**2. Placeholder scan** — 없음. Task 5·6 의 두 곳(`RadioGroup` 오류 마크업 대조, `BASE_VALUES` 실제 이름)은 "기존 파일을 열어 맞춘다" 로 **행동이 명시된** 지시이지 미결이 아니다.

**3. Type consistency** — `petIds: string[]`(Task 1) · `pets: {petId,name}[]`(Task 2) · `basisPetId: string`(Task 3·7) · `petNamesLabel(pets)`(Task 4) · `PetCheckboxGroup`(Task 5)의 이름과 시그니처가 태스크 간에 일치한다.

**계획 작성 중 해소한 위험**: 담기 기준의 기본값을 "대표견" 으로 두려 했으나 `ai-plan-job-view.tsx` 가 반려견 목록을 **전혀 갖고 있지 않음**을 실측으로 확인했다. 기본값 하나를 위해 `usePetList()` 를 붙이면 화면의 데이터 의존이 늘고 조회 실패 시 기본값이 흔들린다. **먼저 고른 아이**(스냅샷 순서 첫 번째)로 바꾸고 명세 D4 도 함께 고쳤다.
