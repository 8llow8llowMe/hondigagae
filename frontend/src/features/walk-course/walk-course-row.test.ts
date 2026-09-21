import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkCourseColumnHead, WalkCourseRow } from '@/features/walk-course/walk-course-row'
import { messages } from '@/lib/messages'
import {
  WALK_COURSE_MIXED_START_END,
  WALK_COURSE_PLAIN,
  WALK_COURSE_ROUND_DISTANCE,
  WALK_COURSE_WITH_COORDS,
} from '@/test/fixtures/walk-course'
import type { WalkCourseFilters, WalkCourseSummary } from '@/types/walk-course'

function render(course: WalkCourseSummary, filters?: WalkCourseFilters): string {
  return renderToStaticMarkup(
    createElement(WalkCourseRow, { course, ...(filters === undefined ? {} : { filters }) }),
  )
}

function renderColumnHead(): string {
  return renderToStaticMarkup(createElement(WalkCourseColumnHead, {}))
}

describe('WalkCourseRow — 코스를 고르는 데 쓰는 값 셋', () => {
  it('이름표 · 구간명 · 거리 · 소요시간 · 시종점을 그린다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).toContain('1코스')
    expect(markup).toContain('시흥-광치기')
    expect(markup).toContain('15.1km')
    expect(markup).toContain('4~5시간')
    expect(markup).toContain('시흥리정류장-광치기해변')
  })

  it('상세로 가는 링크다 — id 를 문자열 그대로 쓴다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('/olle/6911167100216303301')
  })

  /*
    #783. **상세 URL 에는 필터가 없어 상세 혼자서는 복원할 근거가 없다.** 목록이 지금
    보고 있는 조건을 링크에 실어 보내야 `코스 목록으로` 가 같은 목록으로 돌아간다.

    조립은 `walkCourseFilterHref` 가 한다 — 조건이 바뀐 뒤의 주소를 만드는 그 함수와
    같은 규칙이라, 기본값 생략 규칙이 한쪽에서만 바뀌는 일이 없다.
  */
  it('보고 있는 필터를 상세 링크에 실어 보낸다', () => {
    const markup = render(WALK_COURSE_PLAIN, { activity: 'LOW', sort: 'DISTANCE_ASC' })

    expect(markup).toContain('href="/olle/6911167100216303301?activity=LOW&amp;sort=DISTANCE_ASC"')
  })

  it('필터가 기본값이면 쿼리를 붙이지 않는다 — 빈 주소가 기본 상태다', () => {
    const markup = render(WALK_COURSE_PLAIN, { activity: null, sort: null })

    expect(markup).toContain('href="/olle/6911167100216303301"')
  })

  /** `19` 를 `19km` 로 줄이면 같은 열의 `19.1` 과 자릿수가 어긋난다 (공통명세 S3) */
  it('정수 거리도 소수 1자리로 그린다', () => {
    expect(render(WALK_COURSE_ROUND_DISTANCE)).toContain('19.0km')
  })

  /**
   * **원문 그대로다** (D4-4). `제주민속촌주차장 입구-남원포구` 는 공백과 하이픈이 섞여
   * 있어 갈라 재조립하면 잘못 갈린다 — 화살표로 바꾸지도 않는다.
   */
  it('시종점을 원문 그대로 그린다 — 갈라 재조립하지 않는다', () => {
    const markup = render(WALK_COURSE_MIXED_START_END)

    expect(markup).toContain('제주민속촌주차장 입구-남원포구')
    expect(markup).not.toContain('제주민속촌주차장 입구 →')
  })
})

describe('WalkCourseRow — 이미지 (D1-1)', () => {
  /** 실측 29개 중 25개가 이 모양이다. 회색 타일 25개는 정보가 아니라 잡음이다 */
  it('firstImage 가 null 이면 썸네일 자리를 만들지 않는다', () => {
    expect(render(WALK_COURSE_PLAIN)).not.toContain('<img')
  })

  it('firstImage 가 있으면 썸네일을 그린다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('<img')
  })

  /** 바로 옆에 이름표가 글자로 있다 (D6) */
  it('썸네일의 alt 는 빈 문자열이다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('alt=""')
  })

  /**
   * **썸네일이 없어도 5번째 그리드 칸의 자리는 그대로다** (#734). 플렉스였다면 없는
   * 항목만큼 뒤 칸(시종점·chevron)이 당겨졌겠지만, 그리드 트랙은 자식 유무와 무관하게
   * 컨테이너가 정한 폭 그대로 남는다 — 그래서 시종점(4)·chevron(6) 열은 썸네일 유무와
   * 무관하게 항상 같은 칸에 선다.
   */
  it('썸네일이 없으면 5번째 그리드 칸(lg:col-start-5)을 만들지 않는다', () => {
    expect(render(WALK_COURSE_PLAIN)).not.toContain('lg:col-start-5')
  })

  it('썸네일이 있으면 5번째 그리드 칸에 선다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)

    expect(markup).toMatch(/class="bg-band relative size-16[^"]*lg:col-start-5[^"]*"/)
  })
})

describe('WalkCourseRow — 목록은 좌표 유무를 말하지 않는다 (D5-1)', () => {
  /**
   * 좌표는 *골든타임을 이어 볼 수 있는가*만 정한다. 25행에 그 사실을 적으면 코스를 고르는
   * 축과 무관한 정보가 화면의 4/5를 덮는다 — 그 말은 코스 상세가 한 줄로 한다.
   */
  it('좌표가 없는 행에 골든타임·날씨 낱말이 없다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).not.toContain('골든타임')
    expect(markup).not.toContain('날씨')
  })

  it('좌표가 있는 행에도 그 사실을 적지 않는다 — 두 행이 같은 모양이다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)

    expect(markup).not.toContain('골든타임')
    expect(markup).not.toContain('날씨')
  })
})

describe('WalkCourseRow — 열 구성 (#734 · #797 에서 1024 로 내림)', () => {
  /**
   * 코스(1) · 거리(2) · 소요시간(3) · 시종점(4) · 썸네일(5) · chevron(6).
   * 각 칸이 `col-start-N` 으로 자기 자리를 못박는다 — 썸네일 유무와 무관하게 나머지
   * 칸이 밀리지 않는 이유가 이것이다(위 이미지 describe).
   */
  it('코스 · 거리 · 소요시간 · 시종점 · chevron 이 각자 col-start 를 갖는다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).toContain('lg:col-start-1')
    expect(markup).toContain('lg:col-start-2')
    expect(markup).toContain('lg:col-start-3')
    expect(markup).toContain('lg:col-start-4')
    expect(markup).toContain('lg:col-start-6')
  })

  /** 1024 미만 블록(제목 안 요약 줄)과 1024 이상 전용 열이 같은 값을 두 번 들고 있다 */
  it('거리·소요시간·시종점이 1024 미만용과 1024 이상용으로 각각 그려진다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup.match(/15\.1km/g)?.length).toBe(2)
    expect(markup.match(/4~5시간/g)?.length).toBe(2)
    // 1024 이상 열은 `title` 속성에도 원문을 한 번 더 들고 있어 3회다 — truncate 된
    // 텍스트를 마우스 호버로 확인할 수 있게 하는 값이지 중복 렌더가 아니다
    expect(markup.match(/시흥리정류장-광치기해변/g)?.length).toBe(3)
  })

  /** 요약 줄은 열이 생기는 폭에서 숨는다 — 같은 값이 겹쳐 보이면 안 된다 */
  it('요약 줄 둘 다 1024 부터 숨는다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).toMatch(/class="text-body-2 text-fg-muted mt-1 tabular-nums lg:hidden"/)
    expect(markup).toMatch(/class="text-caption text-fg-subtle mt-1 break-keep lg:hidden"/)
  })

  /** 표 안에서는 한 줄로 자른다 — 원문을 갈라 재조립하는 것과는 다르다(D4-4) */
  it('1024 이상 시종점 열은 truncate 이고 title 로 원문을 보존한다', () => {
    const markup = render(WALK_COURSE_MIXED_START_END)

    expect(markup).toContain('title="제주민속촌주차장 입구-남원포구"')
    expect(markup).toMatch(/class="text-caption text-fg-subtle hidden min-w-0 truncate/)
  })
})

describe('WalkCourseColumnHead — 1024 이상 열 머리 (#734 · #797)', () => {
  it('코스 · 거리 · 소요시간 · 시종점 라벨을 그린다 — 행과 같은 문구다', () => {
    const markup = renderColumnHead()

    expect(markup).toContain(messages.walkCourse.columnCourseLabel)
    expect(markup).toContain(messages.walkCourse.distanceLabel)
    expect(markup).toContain(messages.walkCourse.durationLabel)
    expect(markup).toContain(messages.walkCourse.startEndLabel)
  })

  /** 행과 같은 그리드를 공유해야 라벨이 실제 값 위에 선다 */
  it('행과 같은 그리드 클래스를 쓴다', () => {
    expect(renderColumnHead()).toContain('walk-course-row-grid')
  })

  /** 보조기기에는 새 정보가 아니다 — 행 자체가 이미 같은 값을 전부 말한다 */
  it('보조기기에는 감춘다 — aria-hidden', () => {
    expect(renderColumnHead()).toContain('aria-hidden')
  })

  it('1024 미만에서는 숨는다', () => {
    expect(renderColumnHead()).toContain('hidden lg:grid')
  })
})

/*
  #797. **표가 1024 부터 선다.** 예전에는 `xl:`(1280)부터라 1024~1279 가 모바일 레이아웃을
  1004px 로 늘린 모양이었다 (1100 실측: 행 `display:flex` · 열 머리 `display:none` ·
  내용이 왼쪽 972px 블록 안에 세 줄).

  **중간 단계는 필요 없었다.** 코스 열을 484 → 256 으로 줄이자 1024(행 폭 928)에서도
  6칸이 정확히 들어간다 — 칸 수가 폭마다 갈리면 `col-start` 도 갈려야 하고 썸네일·chevron
  이 breakpoint 마다 다른 자리를 갖게 된다.
*/
describe('WalkCourseRow — 1024 부터 표다 (#797)', () => {
  it('행이 1024 부터 그리드가 된다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('lg:grid')
  })

  /** 시종점도 1024 부터 자기 열이다 — 한 폭에서만 인라인으로 남지 않는다 */
  it('시종점 · 썸네일 · chevron 이 모두 1024 부터 자기 열이다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)

    expect(markup).toContain('lg:col-start-4')
    expect(markup).toContain('lg:col-start-5')
    expect(markup).toContain('lg:col-start-6')
  })

  /** 칸 수가 폭마다 갈리지 않는다 — `xl:` 자리 지정이 남아 있으면 안 된다 */
  it('breakpoint 마다 칸 자리가 갈리지 않는다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).not.toContain('xl:col-start')
  })
})

/*
  #797. **썸네일이 있는 행만 높이가 두 배로 튀었다** (1440 실측: `56 · 57 · 113 · 57 · 113 …`).
  목록을 훑을 때 먼저 보이는 것은 세로 튐이다.

  표 안에서는 썸네일을 40px 로 줄이고 행에 최소 높이를 줘 모든 행이 같은 리듬으로 선다.
  1024 미만(카드형 목록)에서는 예전 크기 그대로다 — 거기서는 썸네일이 행의 주인공이다.
*/
describe('WalkCourseRow — 행 높이가 고르다 (#797)', () => {
  it('표 안 썸네일을 줄인다 — 1024 미만 크기는 그대로다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)

    // `md:size-20` 을 함께 단언한다 — "그대로다" 를 실제로 지키는 것이 이 클래스다
    expect(markup).toContain('size-16')
    expect(markup).toContain('md:size-20')
    expect(markup).toContain('lg:size-10')
  })

  it('행이 최소 높이를 갖는다 — 썸네일이 없어도 같은 리듬이다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('lg:min-h-18')
  })
})

/*
  #798. **29행이 전부 링크인데 마우스 신호가 chevron 하나뿐이었다** — 누를 수 있다는 것을
  알려 주는 것이 없었다.

  **채움을 `<li>` 에 건다.** 인셋(`INSET_CLASS`)이 `<li>` 의 좌우 패딩이라 `<a>` 에 걸면
  강조가 카드 끝까지 닿지 않고 행 가운데 띠로 뜬다.

  **다만 `<li>` 가 hover 될 때가 아니라 `<a>` 가 hover 될 때다** (`has-[a:hover]`).
  `<li>` 기준으로 하면 링크 밖 여백에서도 칠해지는데, 거기는 눌러도 아무 일이 없다 —
  강조는 "여기를 누를 수 있다" 는 말이라 누를 수 없는 자리에 두면 거짓이 된다.
*/
describe('WalkCourseRow — 누를 수 있다는 신호 (#798)', () => {
  it('마우스를 올리면 행이 채움으로 반응한다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('has-[a:hover]:bg-band')
  })

  /** 강조가 카드 끝까지 닿아야 행 하나로 읽힌다 — 인셋을 쥔 `<li>` 가 그 폭이다 */
  it('채움을 인셋을 쥔 요소에 건다', () => {
    const markup = render(WALK_COURSE_PLAIN)
    const li = markup.slice(0, markup.indexOf('<a'))

    expect(li).toContain('has-[a:hover]:bg-band')
  })

  /** 키보드 포커스 링은 그대로다 — 둘은 다른 채널이고 서로를 대신하지 않는다 */
  it('포커스 링을 대신하지 않는다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('focus-visible:ring-brand-500')
  })
})

describe('WalkCourseRow — 접근성 계약 (D6)', () => {
  /** 이름표만이면 `1코스` 가 29개라 구분되지 않고, 구간명만이면 사용자가 아는 번호가 사라진다 */
  it('링크의 접근 이름에 이름표와 구간명이 둘 다 들어 있다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('aria-label="1코스 시흥-광치기"')
  })

  /** 이름에는 없지만 행 안의 텍스트로는 읽혀야 한다 */
  it('거리·소요시간을 aria-hidden 으로 감추지 않는다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).not.toMatch(/aria-hidden[^>]*>[^<]*15\.1km/)
  })

  /** 44px — 모바일 최소 터치 영역 (DESIGN.md §7) */
  it('행 링크가 최소 터치 높이를 갖는다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('min-h-11')
  })
})
