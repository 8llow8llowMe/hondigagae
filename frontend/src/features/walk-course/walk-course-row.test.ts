import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkCourseCardGrid, WalkCourseRow } from '@/features/walk-course/walk-course-row'
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

function renderGrid(): string {
  return renderToStaticMarkup(
    createElement(WalkCourseCardGrid, {
      children: createElement(WalkCourseRow, { course: WALK_COURSE_PLAIN }),
    }),
  )
}

/** 카드의 여는 태그만 잘라 낸다 — 마크업 전체에 건 단언은 다른 요소가 통과시켜 준다 */
function cardTag(markup: string): string {
  const start = markup.indexOf('<a')

  return markup.slice(start, markup.indexOf('>', start))
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

/*
  #837. 표에서 카드로 되돌아온 자리다. **표의 잔재가 남아 있으면 두 모양이 섞인다** —
  아래 단언들이 그 경계를 지킨다.
*/
describe('WalkCourseRow — 카드 골격 (#837)', () => {
  it('카드가 자기 테두리와 모서리를 갖는다 — 목록 구분선이 아니다', () => {
    const tag = cardTag(render(WALK_COURSE_PLAIN))

    expect(tag).toContain('border-border')
    expect(tag).toContain('rounded-lg')
  })

  /** 같은 행의 카드 높이를 맞춘다 — 구간명이 두 줄인 카드가 섞여도 아래가 흔들리지 않는다 */
  it('카드가 자리의 높이를 다 쓴다', () => {
    expect(cardTag(render(WALK_COURSE_PLAIN))).toContain('h-full')
  })

  /** 세로로 길면 3열에서 카드가 화면을 넘고, 정사각이면 풍경 사진이 좌우로 잘린다 */
  it('사진이 16:10 이다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('aspect-16/10')
  })

  /**
   * **번호와 구간명이 한 줄이다** (시안 A4). 375 실측에서 29개 전부 한 줄이고(제목 칸
   * 309px · 최장 302px), 넘치더라도 둘이 같은 `<p>` 안에 있어야 `flex-wrap` 이 구간명을
   * 통째로 내린다 — 갈라 두면 이름이 중간에서 끊긴다.
   */
  it('번호와 구간명이 같은 줄에 선다', () => {
    const markup = render(WALK_COURSE_PLAIN)
    const line = markup.slice(markup.indexOf('<p'), markup.indexOf('</p>'))

    expect(line).toContain('1코스')
    expect(line).toContain('시흥-광치기')
  })

  /**
   * **번호는 색과 굵기로 앞선다 — 크기가 아니다.** 앱 타이포 토큰에 15px 이 없어 둘 다
   * `text-body-1` 이고, 임의 px 를 새로 만드는 대신 두 축으로 가른다.
   */
  it('번호가 브랜드색 굵은 글씨다', () => {
    const markup = render(WALK_COURSE_PLAIN)
    const labelStart = markup.indexOf('<span')
    const labelTag = markup.slice(labelStart, markup.indexOf('>', labelStart))

    expect(labelTag).toContain('text-brand-600')
    expect(labelTag).toContain('font-extrabold')
  })

  /**
   * **표의 잔재가 없다.** 6칸 그리드(`.walk-course-row-grid`)와 칸 고정(`lg:col-start-N`),
   * 1024 미만 전용 블록(`lg:hidden`)은 표의 장치였다 — 카드에는 열이 없다.
   */
  it('표 시절의 그리드 장치를 쓰지 않는다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)

    expect(markup).not.toContain('walk-course-row-grid')
    expect(markup).not.toContain('col-start')
    expect(markup).not.toContain('lg:hidden')
  })

  /** 카드는 테두리와 채움이 "누를 수 있다" 를 말한다 — 도장 열을 따로 두지 않는다 */
  it('chevron 을 그리지 않는다', () => {
    expect(render(WALK_COURSE_PLAIN)).not.toContain('<svg')
  })

  /** 표에서는 거리·소요시간이 두 열이라 두 번 그렸다. 카드에서는 한 줄 한 번이다 */
  it('거리·소요시간을 한 번만 그린다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup.split('15.1km')).toHaveLength(2)
    expect(markup.split('4~5시간')).toHaveLength(2)
  })
})

describe('WalkCourseRow — 이미지 (D1-1)', () => {
  /**
   * **재적재 뒤 dev 실데이터는 29/29 가 이미지를 갖는다** (2026-09-21, [#767](https://github.com/8llow8llowMe/hondigagae/issues/767)).
   * 그래도 없는 갈래를 지우지 않는다 — 이미지는 계약이 아니라 TourAPI 매칭에서 오는
   * 데이터라, 원천이 다시 비면 이 카드가 돌아온다. **회색 판을 세우지 않고 글자만 남긴다.**
   */
  it('firstImage 가 null 이면 사진 자리를 만들지 않는다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('aspect-16/10')
  })

  it('firstImage 가 있으면 사진을 그린다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('<img')
  })

  /** 바로 아래에 이름표가 글자로 있다 (D6) */
  it('사진의 alt 는 빈 문자열이다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('alt=""')
  })

  /**
   * **사진이 이름 위에 온다** (시안 A4 — 사진 위에 아무것도 얹지 않는다). 마크업 순서로
   * 잰다 — 클래스만 보면 DOM 순서가 바뀌어도 초록이다.
   */
  it('사진 마크업이 코스 이름보다 앞에 온다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)
    const photoAt = markup.search(/<div class="[^"]*aspect-16\/10/)
    /*
      **`aria-label` 이 아니라 눈에 보이는 이름표로 잰다.** 접근 이름은 `<a>` 속성이라
      언제나 마크업 앞쪽에 있어, 그것으로 재면 사진을 어디에 두든 통과한다.
    */
    const labelAt = markup.search(/<span class="[^"]*font-extrabold[^"]*">/)

    expect(photoAt).toBeGreaterThanOrEqual(0)
    expect(labelAt).toBeGreaterThanOrEqual(0)
    expect(photoAt).toBeLessThan(labelAt)
  })
})

describe('WalkCourseRow — 목록은 좌표 유무를 말하지 않는다 (D5-1)', () => {
  /**
   * 좌표는 *골든타임을 이어 볼 수 있는가*만 정한다. 카드에 그 사실을 적으면 코스를 고르는
   * 축과 무관한 정보가 화면을 덮는다 — 그 말은 코스 상세가 한 줄로 한다.
   *
   * **종점 좌표로 선을 그리지도 않는다** (인계 명세 §2-3). 응답에 경로 좌표열이 없어
   * 두 점을 이으면 실제 올레길과 다른 직선이 된다.
   */
  it('좌표가 없는 카드에 골든타임·날씨 낱말이 없다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).not.toContain('골든타임')
    expect(markup).not.toContain('날씨')
  })

  it('좌표가 있는 카드에도 그 사실을 적지 않는다 — 두 카드가 같은 모양이다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)

    expect(markup).not.toContain('골든타임')
    expect(markup).not.toContain('날씨')
  })
})

/*
  #798. 29개가 전부 링크인데 마우스 신호가 chevron 하나뿐이었다.

  **카드에서는 `<a>` 가 곧 카드 전체다.** 표에서 `<li>` 의 `has-[a:hover]` 를 썼던 이유는
  좌우 인셋이 `<li>` 의 패딩이라 `<a>` 에 걸면 강조가 카드 끝까지 닿지 않아서였는데,
  인셋이 그리드 컨테이너로 올라가면서 그 이유가 사라졌다 — 누를 수 있는 자리와 칠해지는
  자리가 정확히 같아진다.
*/
describe('WalkCourseRow — 누를 수 있다는 신호 (#798)', () => {
  it('마우스를 올리면 카드가 채움으로 반응한다', () => {
    expect(cardTag(render(WALK_COURSE_PLAIN))).toContain('hover:bg-band')
  })

  /** 누를 수 없는 여백이 칠해지면 거짓 신호다 — 채움은 링크 자신에게만 건다 */
  it('채움을 링크 바깥에 걸지 않는다', () => {
    const markup = render(WALK_COURSE_PLAIN)
    const outside = markup.slice(0, markup.indexOf('<a'))

    expect(outside).not.toContain('bg-band')
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

  /** 이름에는 없지만 카드 안의 텍스트로는 읽혀야 한다 */
  it('거리·소요시간을 aria-hidden 으로 감추지 않는다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).not.toMatch(/aria-hidden[^>]*>[^<]*15\.1km/)
  })

  /** 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 사진이 없는 카드가 이 값에 걸린다 */
  it('카드 링크가 최소 터치 높이를 갖는다', () => {
    expect(cardTag(render(WALK_COURSE_PLAIN))).toContain('min-h-11')
  })
})

/*
  #837. 열 수는 1 / 2(768+) / 3(1280+) 이다 (`코스목록-세부명세.md` D1-1) — 표였을 때
  1280+ 에서 남던 빈 폭이 열 수로 해소된다.
*/
describe('WalkCourseCardGrid — 열 수 (#837)', () => {
  it('폭에 따라 1 · 2 · 3 열이다', () => {
    const markup = renderGrid()
    const tag = markup.slice(0, markup.indexOf('>'))

    expect(tag).toContain('grid-cols-1')
    expect(tag).toContain('md:grid-cols-2')
    expect(tag).toContain('xl:grid-cols-3')
  })

  /** 스크린리더가 개수를 읽는다 — 카드가 됐다고 목록 시맨틱을 잃지 않는다 */
  it('ul/li 로 내보낸다', () => {
    const markup = renderGrid()

    expect(markup.startsWith('<ul')).toBe(true)
    expect(markup).toContain('<li')
  })

  /** 인셋이 항목이 아니라 컨테이너에 있다 — 카드가 곧 링크가 되는 근거다 */
  it('좌우 인셋을 컨테이너가 쥔다', () => {
    const markup = renderGrid()
    const tag = markup.slice(0, markup.indexOf('>'))

    expect(tag).toContain('px-4')
  })
})
