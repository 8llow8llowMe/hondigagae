import { describe, expect, it } from 'vitest'

import { DESKTOP_NAV_ITEMS, MOBILE_TAB_ITEMS } from '@/features/nav/menu-items'
import { messages } from '@/lib/messages'
import { readSource, stripComments } from '@/test/source'

/**
 * 진입점과 `WalkTimesSection` 이동 — 공통명세 S6-1 · S6-3.
 *
 * **`home-view.tsx` 는 렌더할 수 없다** (훅을 쓴다). 이 계약은 한 파일 안의 배선이라
 * 소스 문자열로 단언한다 (`src/test/source.ts` 머리주석 — `route-state-surface.test.ts`
 * 가 같은 방식이다). **주석을 걷고 본다**: 이 저장소의 주석에는 경로·컴포넌트명이 그대로
 * 등장해, 걷지 않으면 단언이 주석에 속아 통과한다.
 */
const homeView = stripComments(readSource('src/features/home/home-view.tsx'))

describe('진입점은 홈 배너다 (S6-1)', () => {
  it('홈이 /olle 배너를 그린다', () => {
    expect(homeView).toContain('href="/olle"')
    expect(homeView).toContain('messages.walkCourse.bannerTitle')
  })

  /**
   * nav 셋(장소 찾기·여행 일정·AI 일정 생성)은 *할 일* 축이고 항목을 늘리지 않기로
   * 이미 정해져 있다 (`nav-links.tsx`). 모바일 탭바는 4개 고정이다.
   */
  it('전역 nav 항목을 늘리지 않는다', () => {
    expect(DESKTOP_NAV_ITEMS.map((item) => item.href)).not.toContain('/olle')
    expect(MOBILE_TAB_ITEMS).toHaveLength(4)
    expect(MOBILE_TAB_ITEMS.map((item) => item.href)).not.toContain('/olle')
  })

  /**
   * `Banner` 의 아이콘 자리는 danger 색 고정이다(병원 배너 전용). 산책 코스에 쓰면
   * 상시 진입점이 경보처럼 읽힌다 — 진짜 경보를 구분할 수 없게 된다.
   */
  it('배너에 danger 아이콘을 붙이지 않는다', () => {
    const banner = /<Banner\s+href="\/olle"[\s\S]*?\/>/.exec(homeView)?.[0] ?? ''

    expect(banner).not.toContain('leading')
  })

  it('배너 문구에 코스 개수를 박지 않는다 — 적재(#383)로 바뀐다', () => {
    expect(messages.walkCourse.bannerDescription).not.toMatch(/\d/)
  })

  /**
   * **진입과 도착이 같은 이름을 말한다** ([#810](https://github.com/8llow8llowMe/hondigagae/issues/810)).
   * 배너는 `제주올레 걸어 보기` 인데 도착 화면 제목은 `산책 코스` 였다 — 누른 것과 닿은
   * 곳의 이름이 달랐다. 데이터가 중앙값 15.7km 종주 코스라 `산책` 은 29개 중 28개에
   * 대해 틀린 말이기도 하다 (진단 문서 W-2 · §4-1 ①안).
   */
  it('배너와 화면이 같은 이름을 부른다 — 둘 다 제주올레다', () => {
    expect(messages.walkCourse.bannerTitle).toContain('제주올레')
    expect(messages.walkCourse.pageTitle).toContain('제주올레')
  })

  /**
   * **`산책` 이 돌아오는 것을 막는다.** 위 단언은 `제주올레 산책 코스` 여도 통과한다 —
   * 이 이슈의 근거는 "제주올레라고 말하라" 가 아니라 **"29개 중 28개에 대해 틀린 말인
   * `산책` 을 쓰지 말라"** 였다 (진단 문서 W-2: 중앙값 15.7km · 23/29 가 5시간 이상).
   */
  it('제목이 산책이라고 말하지 않는다', () => {
    expect(messages.walkCourse.pageTitle).not.toContain('산책')
  })

  /**
   * 부제는 **대상어와 시간 축 이름**을 함께 갖는다.
   *
   * - 대상어(`제주올레 코스`): 이 상수는 목록 부제 말고 **404 · 400 화면과 상세
   *   `meta description`** 에도 쓰인다. 제목이 곁에 없는 그 자리에서 대상어가 빠지면
   *   무엇을 고르라는지 말하지 않는다.
   * - `걷는 시간`: 시간 축 이름은 진단 문서 §4-2(D-1)가 한 낱말로 통일했다.
   */
  it('부제가 무엇을 무슨 기준으로 고르는지 말한다', () => {
    expect(messages.walkCourse.pageDescription).toContain('제주올레 코스')
    expect(messages.walkCourse.pageDescription).toContain('걷는 시간')
    expect(messages.walkCourse.pageDescription).not.toContain('소요시간')
  })

  /**
   * **규칙을 한 문자열에만 걸어 두어 나머지가 새어 나갔다**
   * ([#824](https://github.com/8llow8llowMe/hondigagae/issues/824)). 위 단언은 `pageDescription`
   * 만 보는데, 정작 값에 붙는 라벨(`durationLabel`)이 `소요시간` 이었다 — 목록 열 머리와
   * 상세 `<dl>` 이 그 상수를 공유하므로 두 화면이 함께 어긋나 있었다.
   *
   * 그래서 **사용자에게 보이는 walk-course 문구 전체**를 훑는다. 새 문구가 `소요시간` 을
   * 들고 들어오면 여기서 걸린다.
   */
  it('사용자에게 보이는 문구 어디에도 소요시간이 없다', () => {
    const leaked = Object.entries(messages.walkCourse)
      .filter(([, value]) => typeof value === 'string' && value.includes('소요시간'))
      .map(([key]) => key)

    expect(leaked, `시간 축 이름이 갈린 문구: ${leaked.join(', ')}`).toEqual([])
  })

  /** 거를 수 있는 축은 `활동량` 하나다 — 0건 안내가 없는 컨트롤을 가리키지 않게 한다 */
  it('0건 안내가 필터 축의 이름으로 말한다', () => {
    expect(messages.walkCourse.emptyDescription).toContain(messages.walkCourse.activityGroupLabel)
  })
})

describe('WalkTimesSection 이동 — 홈 마크업은 그대로다 (S6-3)', () => {
  /** feature 간 직접 임포트를 피한다 (`architecture-guide.md` §3) */
  it('홈이 새 경로에서 임포트한다', () => {
    expect(homeView).toContain("from '@/features/insight/walk-times-section'")
    expect(homeView).not.toContain("from '@/features/home/walk-times-section'")
  })

  it('골든타임 훅도 같은 자리로 옮겼다', () => {
    expect(homeView).toContain("from '@/features/insight/use-walk-times'")
  })

  /**
   * **넘기는 prop 이 그대로여야 마크업이 그대로다.** 특히 `retryLabel` 을 넘기지 않아야
   * 기본값(`messages.common.retry`)이 유지된다 — 산책 코스 상세만 그 값을 바꾼다 (D6).
   */
  it('홈은 옛 네 prop 만 넘긴다 — retryLabel 을 주지 않는다', () => {
    const usage = /<WalkTimesSection[\s\S]*?\/>/.exec(homeView)?.[0] ?? ''

    expect(usage).toContain('data=')
    expect(usage).toContain('loading=')
    expect(usage).toContain('basis=')
    expect(usage).toContain('onRetry=')
    expect(usage).not.toContain('retryLabel')
  })
})

/*
  #826. **진입점 하나(홈 배너)는 그대로 두고, 나가는 길을 하나 만들었다.**

  이 화면은 들어오는 길이 배너뿐이고 나가는 길이 `코스 목록으로` 뿐이라 서비스 안에서
  막다른 길이었다. 전역 nav 에 넣지 않기로 한 S6-1 은 그대로다 — 그 결정이 "코스 화면을
  고립시킨다" 까지 뜻하지는 않았다.
*/
describe('나가는 길 — 시작점 근처 장소 (S6-1 · #826)', () => {
  const detailSection = stripComments(
    readSource('src/features/walk-course/walk-course-detail-section.tsx'),
  )
  const detailView = stripComments(
    readSource('src/features/walk-course/walk-course-detail-view.tsx'),
  )

  it('상세가 근처 장소 섹션을 세운다', () => {
    expect(detailSection).toContain('<WalkCourseNearbyPlaces')
  })

  /**
   * **출처 각주보다 위다.** 각주는 문서 끝이고, 그 아래에 링크를 두면 페이지가 끝난 뒤에
   * 다시 시작하는 모양이 된다. 마크업 순서로 잰다 — 클래스만 보면 순서가 바뀌어도 초록이다.
   */
  it('출처 각주보다 먼저 온다', () => {
    const nearbyAt = detailSection.indexOf('<WalkCourseNearbyPlaces')
    const sourceAt = detailSection.indexOf('<WalkCourseSourceLine')

    expect(nearbyAt).toBeGreaterThanOrEqual(0)
    expect(sourceAt).toBeGreaterThanOrEqual(0)
    expect(nearbyAt).toBeLessThan(sourceAt)
  })

  /**
   * **골든타임과 같은 좌표에 걸린다.** 코스가 가진 좌표는 시작점 하나뿐이라(`endLat` 은
   * dev 값이 0/29 다) 좌표가 없으면 두 조회가 함께 꺼진다 — 한쪽만 켜지면 화면이 없는
   * 근거로 말하게 된다.
   */
  it('좌표가 없으면 조회하지 않는다', () => {
    expect(detailView).toContain('position !== null')
  })

  /**
   * **전체 보기 링크를 달지 않는다.** `/places` 는 URL 로 지도 중심을 받지 못해
   * (`lib/url/place-filters.ts` 에 `lat`/`lng` 가 없다) 시작점과 무관한 제주 전체 목록으로
   * 떨어진다 — 누른 것과 닿는 곳이 어긋난다(#810 이 배너에서 잡은 것과 같은 종류).
   * `place-filters.ts` 에 좌표 축이 생기면 이 단언을 걷고 링크를 단다.
   */
  it('장소 목록 화면으로 보내지 않는다', () => {
    expect(detailSection).not.toContain('href="/places"')
  })

  /** 진입점은 여전히 배너 하나다 — 이 이슈가 늘린 것은 *나가는* 길이다 */
  it('전역 nav 는 그대로다', () => {
    expect(DESKTOP_NAV_ITEMS.map((item) => item.href)).not.toContain('/olle')
    expect(MOBILE_TAB_ITEMS).toHaveLength(4)
  })
})
