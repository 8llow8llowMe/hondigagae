import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import {
  invalidateAllPlanBriefings,
  invalidatePlanBriefing,
} from '@/features/plan/plan-briefing-invalidation'
import { planKeys } from '@/features/plan/queries'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 일정을 고친 뒤 출발 전 브리핑이 옛 시각·방문 수를 보이던 것 (#1055).
 *
 * **근본원인**: `planKeys.briefing` 은 인사이트 표준값(5분)인데 일정을 바꾸는 어떤 쓰기도 이
 * key 를 무효화하지 않았다. 브리핑의 `schedule`(첫/마지막 항목 시각 · 방문 수 · 대표 장소)은
 * `PlanBriefingProcessor.toScheduleInfo` 가 **그날 항목에서 그대로** 만든다 — 예보가 아니다.
 *
 * node 환경이라 `QueryObserver` 로 "화면이 관찰 중" 을 만든다 (`pet-delete-invalidation.test.ts`
 * 와 같은 방식).
 */

const PLAN_ID = '223456789012000001'
const OTHER_PLAN_ID = '223456789012000002'
const DAY_ONE = '2026-10-03'
const DAY_TWO = '2026-10-04'

const clients: QueryClient[] = []
const unsubscribes: (() => void)[] = []

afterEach(() => {
  unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe())
  clients.splice(0).forEach((client) => client.clear())
})

function client(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(queryClient)
  return queryClient
}

/** 데이터를 채운 뒤 관찰을 붙인다. 받은 횟수를 센다 */
function observed(queryClient: QueryClient, queryKey: readonly unknown[]): { calls: number } {
  const counter = { calls: 0 }
  queryClient.setQueryData(queryKey, { seeded: true })

  const observer = new QueryObserver(queryClient, {
    queryKey,
    queryFn: () => {
      counter.calls += 1
      return { refetched: true }
    },
    // 채워 둔 값이 신선해야 관찰을 붙이는 순간 받지 않는다 — 센 횟수가 무효화 몫만 남는다
    staleTime: Infinity,
  })
  unsubscribes.push(observer.subscribe(() => undefined))

  return counter
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('일정 쓰기 뒤 브리핑 무효화 (#1055)', () => {
  it('원인 재현 — 상세만 무효화하면 브리핑은 신선한 채로 남는다', async () => {
    const queryClient = client()
    const briefing = observed(queryClient, planKeys.briefing(PLAN_ID, DAY_ONE))

    await queryClient.invalidateQueries({ queryKey: planKeys.detail(PLAN_ID) })
    await settle()

    expect(briefing.calls).toBe(0)
    expect(queryClient.getQueryState(planKeys.briefing(PLAN_ID, DAY_ONE))?.isInvalidated).toBe(
      false,
    )
  })

  /*
    **날짜를 가리지 않는다.** 화면은 여는 시점에 날짜를 고르고(`pickBriefingDate`), 기간을 고치면
    옛 날짜의 브리핑이 캐시에 남는다. 어느 날짜를 바꿨는지 가려내면 서버 규칙을 복제한다.
  */
  it('그 일정의 브리핑을 날짜와 무관하게 전부 다시 받는다', async () => {
    const queryClient = client()
    const dayOne = observed(queryClient, planKeys.briefing(PLAN_ID, DAY_ONE))
    const dayTwo = observed(queryClient, planKeys.briefing(PLAN_ID, DAY_TWO))

    await invalidatePlanBriefing(queryClient, PLAN_ID)
    await settle()

    expect(dayOne.calls).toBe(1)
    expect(dayTwo.calls).toBe(1)
  })

  it('다른 일정의 브리핑과 그 일정의 다른 절은 건드리지 않는다', async () => {
    const queryClient = client()
    const other = observed(queryClient, planKeys.briefing(OTHER_PLAN_ID, DAY_ONE))
    const detail = observed(queryClient, planKeys.detail(PLAN_ID))
    const weather = observed(queryClient, planKeys.weather(PLAN_ID))

    await invalidatePlanBriefing(queryClient, PLAN_ID)
    await settle()

    expect(other.calls).toBe(0)
    expect(detail.calls).toBe(0)
    expect(weather.calls).toBe(0)
  })

  /*
    브리핑 화면은 별도 라우트라 쓰기 순간에는 대개 관찰자가 없다. 그때는 받지 않고 **낡음 표시만**
    남아, 다시 열 때 받는다 — 무효화의 기본 동작(`refetchType: 'active'`)이다.
  */
  it('관찰 중이 아닌 브리핑은 낡음 표시만 한다', async () => {
    const queryClient = client()
    queryClient.setQueryData(planKeys.briefing(PLAN_ID, DAY_ONE), { seeded: true })

    await invalidatePlanBriefing(queryClient, PLAN_ID)

    expect(queryClient.getQueryState(planKeys.briefing(PLAN_ID, DAY_ONE))?.isInvalidated).toBe(true)
  })

  it('반려견 특성을 고치면 모든 일정의 브리핑을 다시 받는다 — 상세·목록은 두고', async () => {
    const queryClient = client()
    const mine = observed(queryClient, planKeys.briefing(PLAN_ID, DAY_ONE))
    const other = observed(queryClient, planKeys.briefing(OTHER_PLAN_ID, DAY_TWO))
    const detail = observed(queryClient, planKeys.detail(PLAN_ID))
    const list = observed(queryClient, planKeys.list())

    await invalidateAllPlanBriefings(queryClient)
    await settle()

    expect(mine.calls).toBe(1)
    expect(other.calls).toBe(1)
    expect(detail.calls).toBe(0)
    expect(list.calls).toBe(0)
  })
})

/*
  **경로가 늘어도 빠지지 않게 쓰기 API 기준으로 훑는다.** 호출처를 이름으로 나열하면 새 담기
  경로가 생겼을 때 이 목록도 같이 빠진다. 기존 일정의 항목·기간·동행견·상태를 바꾸는 API 를
  쓰는 파일은 모두 브리핑을 무효화해야 한다.

  **호출이 아니라 import 로 가른다.** `이름(` 으로 찾으면 별칭 import(`as replace`)와 참조
  전달(`onSave={updatePlan}`)이 조용히 빠진다. API 모듈에서 그 이름을 가져오는 파일이면 쓰는
  파일이다.

  빠진 것: `createPlan`·`copyPlan`(새 planId 라 캐시가 없다), `deletePlan`(브리핑 라우트가
  상세 404 가드에서 먼저 떨어진다).

  **한계 — 파일 단위다.** 한 파일에 쓰기 지점이 둘이고 하나만 무효화해도 통과한다. 지금은
  대상 파일마다 쓰기 지점이 하나다.
*/
const PLAN_WRITE_API = ['replaceDayItems', 'markItemVisited', 'changeItemStartTime', 'updatePlan']
const PET_WRITE_API = ['updatePet']

/** `import { a, b as c } from '<module>'` 의 중괄호 안 이름들 (여러 줄 · 별칭 포함) */
function importedNames(source: string, module: string): string[] {
  const pattern = new RegExp(
    `import\\s*(?:type\\s*)?\\{([^}]*)\\}\\s*from\\s*'${module.replace(/[/@]/g, '\\$&')}'`,
    'g',
  )
  return [...source.matchAll(pattern)].flatMap((match) =>
    (match[1] ?? '')
      .split(',')
      .map(
        (entry) =>
          entry
            .trim()
            .split(/\s+as\s+/)[0]
            ?.trim() ?? '',
      )
      .filter(Boolean),
  )
}

/** 훑기 범위 — `src/` 와 라우트(`app/`). API 모듈 자신과 테스트는 뺀다 */
function appSources(): string[] {
  return ['src', 'app'].flatMap((dir) => {
    const root = fileURLToPath(new URL(`../../../${dir}/`, import.meta.url))
    return readdirSync(root, { recursive: true })
      .map((file) => `${dir}/${String(file).split('\\').join('/')}`)
      .filter(
        (file) =>
          /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.startsWith('src/lib/api/'),
      )
  })
}

function writersOf(module: string, api: readonly string[]): string[] {
  return appSources().filter((file) =>
    importedNames(readSourceWithoutComments(file), module).some((name) => api.includes(name)),
  )
}

describe('일정 쓰기 호출처가 브리핑을 무효화한다 (#1055)', () => {
  const writers = writersOf('@/lib/api/plan', PLAN_WRITE_API)
  const petWriters = writersOf('@/lib/api/pet', PET_WRITE_API)

  it('훑기가 비지 않았다 — 알려진 쓰기 경로가 모두 잡힌다', () => {
    expect(writers).toEqual(
      expect.arrayContaining([
        'src/features/plan/use-plan-item-time.ts',
        'src/features/plan/use-plan-visit.ts',
        'src/features/plan/use-plan-day-edit.ts',
        'src/features/plan/use-plan-add-place.ts',
        'src/features/plan/use-plan-add-move.ts',
        'src/features/plan/place-add-to-plan-sheet.tsx',
        'src/features/plan/walk-course-add-to-plan-sheet.tsx',
        'src/features/plan/plan-day-regenerate-view.tsx',
        'src/features/plan/plan-edit-modal.tsx',
        'src/features/plan/use-plan-status.ts',
      ]),
    )
  })

  it.each(writers)('%s 가 invalidatePlanBriefing 을 부른다', (file) => {
    expect(readSourceWithoutComments(file)).toMatch(/\binvalidatePlanBriefing\(/)
  })

  it('반려견 수정 훑기가 비지 않았다', () => {
    expect(petWriters).toEqual(expect.arrayContaining(['src/features/pet/pet-edit-view.tsx']))
  })

  it.each(petWriters)('%s 가 모든 일정의 브리핑을 무효화한다', (file) => {
    expect(readSourceWithoutComments(file)).toMatch(/\binvalidateAllPlanBriefings\(/)
  })

  it('import 판정이 별칭 · 여러 줄 import 를 잡는다', () => {
    expect(
      importedNames(
        "import {\n  fetchPlan,\n  replaceDayItems as replace,\n} from '@/lib/api/plan'",
        '@/lib/api/plan',
      ),
    ).toEqual(['fetchPlan', 'replaceDayItems'])
  })
})
