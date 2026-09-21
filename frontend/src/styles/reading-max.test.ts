import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import {
  WalkCourseDetailSection,
  type WalkCourseDetailSectionProps,
} from '@/features/walk-course/walk-course-detail-section'
import {
  WALK_COURSE_PLAIN,
  WALK_COURSE_WITH_COORDS,
  walkCourseDetail,
} from '@/test/fixtures/walk-course'
import { readSourceWithoutComments } from '@/test/source'
import { readDesignMd, readGlobalsCss, readTokensCss } from '@/test/tokens'

/**
 * 읽는 폭 컨테이너 회귀 검사 — 이슈 [#781](https://github.com/8llow8llowMe/hondigagae/issues/781).
 *
 * `content-max.test.ts` 와 같은 축이다: 레이아웃 토큰은 기계 동기 대상이 아니라
 * `tokens.css` 와 `DESIGN.md` 가 조용히 갈라질 수 있어 여기서 잡는다.
 *
 * **왜 `--content-max` 로 안 되는가.** 1440 은 *"콘텐츠가 화면 끝까지 가지 않는다"* 는
 * 캡이지 **읽는 폭**이 아니다. 코스 상세 25/29(히어로 없는 갈래)가 그 1440 을 그대로
 * 채워 `거리 15.1km` 와 `소요시간 4~5시간` 이 689px 떨어져 있었다 — 한 줄로 묶여 읽혀야
 * 하는 값 둘이 눈으로 따라갈 수 없는 거리에 있었다.
 */

const tokens = readTokensCss()
const globals = readGlobalsCss()
const design = readDesignMd()

describe('읽는 폭 — 토큰 (#781)', () => {
  it('--reading-max 가 760px 로 선언돼 있다', () => {
    expect(tokens).toMatch(/--reading-max:\s*760px;/)
  })

  it('--content-max 와 다른 값이다 — 같아지면 캡이 하나뿐인 것과 같다', () => {
    expect(tokens).toMatch(/--content-max:\s*1440px;/)
  })
})

describe('읽는 폭 — 캡 규칙 (#781)', () => {
  const container = globals.match(/^\.reading-container\s*\{[^}]*\}/m)?.[0]

  it('.reading-container 가 폭으로 캡하고 가운데 세운다', () => {
    expect(container).toBeDefined()
    expect(container).toContain('max-inline-size: var(--reading-max)')
    expect(container).toContain('margin-inline: auto')
  })

  it('토큰으로 캡한다 — 리터럴 760 을 다시 적지 않는다', () => {
    expect(container).not.toContain('760')
  })

  it('캡 규칙이 @media 밖 최상위에 있다', () => {
    expect(globals).toMatch(/^\.reading-container\s*\{/m)
  })
})

describe('읽는 폭 — 문서 동기 (#781)', () => {
  it('DESIGN.md §7 레이아웃 토큰 표에 --reading-max 가 있다', () => {
    expect(design).toContain('--reading-max')
  })
})

/*
  **히어로가 있는 갈래는 캡하지 않는다.** 그 4개는 `lg:grid-cols-2` 로 이미 각 681px 이라
  읽는 폭 안이고, 거기에 760 을 걸면 2열이 무너진다. 캡은 히어로 없는 25개만의 문제다.

  **소스 문자열이 아니라 마크업을 본다.** 이 파일의 첫 판은 소스를 통째로 읽어
  `toContain('reading-container')` 했는데, 그 낱말이 **바로 위 주석에도 있어** 구현을
  지워도 통과했다 — `@/test/source` 머리주석이 경고하는 #451 의 함정 그대로다.
*/
function renderDetail(overrides: Partial<WalkCourseDetailSectionProps> = {}): string {
  return renderToStaticMarkup(
    createElement(WalkCourseDetailSection, {
      course: walkCourseDetail(WALK_COURSE_PLAIN),
      loading: false,
      errorStatus: null,
      onRetry: vi.fn(),
      walkTimes: null,
      walkTimesLoading: false,
      onWalkTimesRetry: vi.fn(),
      authed: false,
      ...overrides,
    }),
  )
}

describe('읽는 폭 — 코스 상세가 갈래에 따라 캡을 고른다 (#781)', () => {
  it('히어로가 없으면 읽는 폭에서 멈춘다 — 25/29 가 이 갈래다', () => {
    const markup = renderDetail()

    expect(markup).toContain('reading-container')
    expect(markup).not.toContain('content-container')
  })

  it('히어로가 있으면 캡하지 않는다 — 2열이 무너진다', () => {
    const markup = renderDetail({ course: walkCourseDetail(WALK_COURSE_WITH_COORDS) })

    expect(markup).toContain('content-container')
    expect(markup).not.toContain('reading-container')
  })

  it('두 캡을 겹쳐 달지 않는다 — 같은 특정도라 순서로 이긴다', () => {
    for (const markup of [
      renderDetail(),
      renderDetail({ course: walkCourseDetail(WALK_COURSE_WITH_COORDS) }),
    ]) {
      const both =
        /class="[^"]*content-container[^"]*reading-container|class="[^"]*reading-container[^"]*content-container/
      expect(markup).not.toMatch(both)
    }
  })

  it('Tailwind arbitrary 로 캡하지 않는다 — eslint noComplexArbitrary', () => {
    const section = readSourceWithoutComments(
      'src/features/walk-course/walk-course-detail-section.tsx',
    )

    expect(section).not.toContain('max-w-[var(')
  })
})

/*
  주 버튼이 컨테이너 폭을 그대로 먹지 않는다 — 1440 에서 `일정에 담기` 가 1346×48px 이었다.
  **360 이 아니라 `max-w-sm`(384) 인 이유**: 360 은 Tailwind 스케일 밖이라 `max-w-[360px]`
  가 되는데, 이 저장소의 eslint 가 토큰 밖 arbitrary value 를 막는다 (DESIGN.md §2·§4).
*/
describe('읽는 폭 — 주 버튼 (#781)', () => {
  /*
    **주석을 걷고 본다.** 이 파일의 주석이 `max-w-[360px]` 을 왜 안 쓰는지 설명해서,
    걷지 않으면 "arbitrary 를 쓰지 않는다" 단언이 헛되이 실패한다 (`@/test/source`).
  */
  const action = readSourceWithoutComments('src/features/walk-course/walk-course-add-action.tsx')

  it('버튼이 스케일 값으로 폭을 제한한다 — 모바일에서는 여전히 전폭이다', () => {
    expect(action).toContain('w-full max-w-sm')
    expect(action).not.toContain('max-w-[')
  })
})
