import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { petEditPageTitle } from '@/lib/pet/detail-title'
import { placeDetailFallbackTitle } from '@/lib/place/detail-title'
import { planDetailTitle } from '@/lib/plan/detail-title'
import { walkCourseDetailFallbackTitle } from '@/lib/walk-course/detail-title'
import { readSourceWithoutComments as code } from '@/test/source'

/**
 * **없는 대상 화면의 `h1` 과 탭 제목이 같은 말을 한다** — 이슈 #980.
 *
 * `docs/architecture-guide.md` §7 #206 절이 "탭 제목은 본문과 같은 판정을 쓴다" 를 정했고
 * #676 이 404 탭 제목을 `page.tsx` 의 `generateMetadata` 로 모았다. 그런데 **짝의 다른 쪽인
 * 경계의 `h1` 은 누구도 잠그지 않았다** — `/pets/{없는 id}` 는 탭이 `존재하지 않는 반려견이에요`
 * 인데 `h1` 이 `반려견 정보 수정` 이었다. 스크린리더는 문서 제목과 최상위 제목을 연달아
 * 읽으므로 두 값이 다른 화면을 가리키면 어느 쪽을 믿을지 알 수 없다.
 *
 * **한 행이 짝 하나를 잠근다** — 경계 소스에 그 상수로 된 `h1` 이 있고(`probe`), 그 상수의
 * 값이 탭 제목 판정 함수가 그 상태에서 고르는 문자열과 같다(`tab`). 어느 한쪽만 바뀌어도
 * 깨진다. 판정 함수를 부르는 것은 탭 제목이 `generateMetadata` 안에서 이 함수로 정해지기
 * 때문이다 — async server component 는 렌더되지 않는다 (`testing-guide.md` §1).
 *
 * **소스는 주석을 걷고 읽는다.** 경계 파일 주석이 예전 `h1` 을 인용하면 거기에 속는다.
 */
const notFound = (code: string) => new ApiError(404, code, null)

type Pair = {
  /** 상태를 그리는 소스 (경계 파일이거나 그 본문을 가진 컴포넌트) */
  path: string
  /** 그 소스 안에서 `h1` 을 세우는 조각 — 이름이 된 `messages` 키가 들어 있다 */
  probe: string
  /** `probe` 가 가리키는 상수의 실제 값 */
  heading: string
  /** 같은 상태에서 탭 제목 판정 함수가 고르는 문자열 (접미사 전) */
  tab: string
}

const PAIRS: Pair[] = [
  {
    path: 'app/(main)/places/[placeId]/not-found.tsx',
    probe: '<h1 className="sr-only">{messages.place.detailNotFoundTitle}</h1>',
    heading: messages.place.detailNotFoundTitle,
    tab: placeDetailFallbackTitle(notFound('PLACE_002')),
  },
  {
    path: 'app/(main)/plans/[planId]/not-found.tsx',
    probe: '<h1 className="sr-only">{messages.plan.detailNotFoundTitle}</h1>',
    heading: messages.plan.detailNotFoundTitle,
    tab: planDetailTitle(notFound('PLAN_001')),
  },
  /*
    **#980 이 고친 자리.** 예전 `h1` 은 화면 이름(`editTitle`)이었다 — #481 의 "경계가 화면
    이름을 바꾸면 안 된다" 를 따른 것인데, 그 규칙은 **화면이 살아 있다가 예외로 죽은**
    `error.tsx` 의 것이다. 없는 반려견에는 수정할 화면이 없고, 탭은 #676 부터 이미 상태를
    말한다. 근거 전문은 `not-found.tsx` 머리주석과 `수정-세부명세.md` D5.
  */
  {
    path: 'app/(main)/pets/[petId]/not-found.tsx',
    probe: '<h1 className="sr-only">{messages.pet.notFoundTitle}</h1>',
    heading: messages.pet.notFoundTitle,
    tab: petEditPageTitle(notFound('PET_001')),
  },
  /*
    **경계 파일이 없는 자리.** 올레 상세는 `notFound()` 를 부르지 않고(soft 200 — 본문이 서버
    `resultMessage` 를 그려야 한다, `page.tsx` 머리주석) 화면 안에서 404 를 그린다. 그 갈래의
    `h1` 은 `DetailShell` 의 `heading` 이다. 탭은 예전에 `제주올레 코스` 였다 (#980).
  */
  {
    path: 'src/features/walk-course/walk-course-detail-section.tsx',
    probe: '<DetailShell heading={messages.walkCourse.detailNotFoundTitle}>',
    heading: messages.walkCourse.detailNotFoundTitle,
    tab: walkCourseDetailFallbackTitle(notFound('WALKCOURSE_001')),
  },
]

describe('없는 대상 화면 — h1 과 탭 제목이 같은 말을 한다 (#980)', () => {
  it.each(PAIRS)('$path — h1 이 탭 제목과 같은 상수다', ({ path, probe, heading, tab }) => {
    const source = code(path)

    expect(source).toContain(probe)
    expect(source.match(/<h1\b/g)).toHaveLength(1)
    expect(heading).toBe(tab)
  })
})

/*
  **판정 함수를 실제로 부르는가.** 위 표는 함수가 고르는 값을 보지만, `generateMetadata` 가 그
  함수를 쓰지 않으면 아무 의미가 없다 — 올레 상세가 정확히 그랬다(catch 가 목록 제목을 직접
  냈다). async server component 라 부를 수 없어 소스로 잠근다.
*/
const METADATA_CALLS: Array<{ page: string; call: string }> = [
  { page: 'app/(main)/places/[placeId]/page.tsx', call: 'placeDetailFallbackTitle(error)' },
  { page: 'app/(main)/plans/[planId]/page.tsx', call: 'planDetailTitle(error)' },
  { page: 'app/(main)/pets/[petId]/page.tsx', call: 'petEditPageTitle(error)' },
  {
    page: 'app/(main)/olle/[walkCourseId]/page.tsx',
    call: 'return walkCourseDetailFallbackMetadata(error)',
  },
]

describe('generateMetadata 가 판정 함수로 제목을 정한다 (#980)', () => {
  it.each(METADATA_CALLS)('$page', ({ page, call }) => {
    const source = code(page)

    expect(source).toContain('export async function generateMetadata')
    expect(source).toContain(call)
  })
})
