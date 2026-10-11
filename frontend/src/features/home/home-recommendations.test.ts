import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { openingTags, readSourceWithoutComments as source } from '@/test/source'

/**
 * 홈 `오늘 갈 만한 곳` 을 장소 추천 한 번으로 (#1380 · #1386 · 홈-세부명세 D10).
 *
 * ### 왜 소스 단언인가
 *
 * `home-view.tsx` 는 React Query 훅을 부르는 client component 이고 `page.tsx` 는 async server
 * component 라 node 환경에서 렌더하지 못한다 (`testing-guide.md` §1). 규칙은 순수 함수
 * (`lib/insight/recommendation.ts`)가 잠그고, 여기서는 **홈이 무엇을 부르고 어디에 꽂는가**만 잠근다.
 */
const HOME = source('src/features/home/home-view.tsx')
const PAGE = source('app/(main)/(home)/page.tsx')
const HOOKS = source('src/features/home/use-home-insight.ts')

describe('홈 → 장소 추천 (#1380)', () => {
  it('추천을 홈 카드 수만큼 한 번 부른다', () => {
    expect(HOME).toContain('useRecommendations(condition, TOP_PLACE_COUNT, conditionReady)')
    expect(HOOKS).toContain('recommendationsPath(condition, limit)')
  })

  /*
    로그인 사용자는 반려견 목록 · 고른 반려견 복원 뒤에야 조건이 선다. 그 전에 부르면 조건 없는 콜드 계산
    하나가 버려진다(#1380 검토). 게스트는 기다리지 않는다.
  */
  it('조건이 정해진 뒤에만 부른다', () => {
    expect(HOME).toContain(
      'const conditionReady = !authed || (!petList.isPending && storedPetId !== undefined)',
    )
    expect(HOOKS).toMatch(/useQuery\(\{[\s\S]*?enabled,[\s\S]*?\}\)/)
  })

  /* 목록 앞 N곳 + 적합도 N건(N+1)으로 돌아가지 않는다 */
  it('목록 앞 N곳 · 적합도 N건 경로가 남아 있지 않다', () => {
    expect(HOME).not.toMatch(/useSuitabilities|pickTopPlaces|orderByScore|placeById/)
    expect(HOOKS).not.toContain('useQueries')
  })

  /*
    **서버 프리페치하지 않는다** — 콜드 18초가 첫 HTML 을 막는다. 홈 서버는 목록도 받지 않는다:
    목록의 쓰임은 적합도 후보와 끝 카드의 전체 수뿐이었다.
  */
  it('page.tsx 가 장소 목록도 추천도 받지 않는다', () => {
    expect(PAGE).not.toMatch(/placeListPath|DEFAULT_PLACE_FILTERS|recommendationsPath/)
    expect(PAGE).not.toContain('insightKeys.recommendations')
    expect(openingTags(PAGE, /<HomeView\b/g)[0]).not.toContain('places=')
  })

  it('카드는 추천 항목을 옮긴 것이고 기준 장소를 뺀다', () => {
    expect(HOME).toContain('toRecommendationCards(recommendations.data, basisPlaceId)')

    const card = openingTags(HOME, /<PlaceInsightCard\b/g)[0] ?? ''
    expect(card).toContain('place={place}')
  })

  /* 404 · 4xx 에 재시도 버튼을 달지 않는다 — 재시도는 `recommendationFailure` 가 허락할 때만 */
  it('오류 상태의 재시도는 재시도할 수 있는 실패에만 선다', () => {
    expect(HOME).toContain('recommendationFailure(recommendations.error)')
    expect(HOME).toMatch(/failure\?\.retry === true \? \(\s*<ErrorState/)
  })
})

/*
  **카드가 전부 `주의 필요` 이하면 제목을 낮춘다** (D10-3). 판정은 `allCardsCautious` 가 잠그고,
  여기서는 제목이 그 판정을 먼저 보는지 본다 — 반려견 이름 갈래가 먼저면 로그인 사용자에게만
  `갈 만한 곳` 이 남는다.
*/
describe('홈 → 섹션 제목 낮추기 (#1380)', () => {
  it('allCardsCautious 가 반려견 갈래보다 먼저다', () => {
    const at = HOME.indexOf('const heading =')
    const heading = HOME.slice(at, HOME.indexOf('\n\n', at))

    expect(heading.indexOf('allCardsCautious(loaded)')).toBeGreaterThan(-1)
    expect(heading.indexOf('suitabilityCautiousHeading')).toBeLessThan(
      heading.indexOf('suitabilityFallback'),
    )
  })

  it('문구가 권하지 않는다', () => {
    expect(messages.home.suitabilityCautiousHeading).toBe('오늘 장소 상황')
    expect(messages.home.suitabilityCautiousHeading).not.toContain('갈 만한')
  })
})

/*
  **실내 대안은 추천 카드 위다** (D10-5). DOM 순서로 올린다 — `order` 로 당기면 보이는 순서와
  키보드 · 스크린리더 순서가 갈린다(WCAG 1.3.2). `order-*` 금지는 `home-about-link.test.ts` 가 잠근다.
*/
describe('홈 → 실내 대안 자리 (#1380)', () => {
  it('실내 대안이 오늘 갈 만한 곳보다 먼저 선다', () => {
    const indoor = HOME.indexOf('<IndoorAlternativesSection')
    const suitability = HOME.indexOf('titleId="suitability-heading"')

    expect(indoor).toBeGreaterThan(-1)
    expect(indoor).toBeLessThan(suitability)
    expect(HOME.split('<IndoorAlternativesSection').length - 1).toBe(1)
  })

  it('캡션이 카드를 아래에서 가리킨다', () => {
    expect(messages.home.indoorNote).toContain('아래')
    expect(messages.home.indoorNote).not.toContain('위 목록')
  })
})

/*
  **특보는 띠 한 곳에서만 말한다** (#349). 추천 응답 머리의 특보도 같은 단일 지점 값이라 목록 머리에
  따로 세우지 않고 띠의 소스에 넣는다 — 콜드면 가장 늦게 와 마지막 폴백이다 (D10-6).
*/
describe('홈 → 특보 소스 (#1380)', () => {
  it('추천 응답의 특보가 띠의 마지막 후보다', () => {
    const strip = openingTags(HOME, /<WeatherWarningStrip\b/g)[0] ?? ''
    const candidates = strip.slice(strip.indexOf('pickWeatherWarning(['))

    expect(candidates).toMatch(
      /regionalWeather\.data\?\.weatherWarning,\s*walkSafety\.data\?\.weatherWarning,\s*walkTimes\.data\?\.weatherWarning,\s*recommendations\.data\?\.weatherWarning,?\s*\]/,
    )
  })

  it('특보 배지를 목록 머리에 따로 그리지 않는다', () => {
    expect(HOME.split('<WeatherWarningStrip').length - 1).toBe(1)
    expect(HOME).not.toContain('<WeatherWarningBadge')
  })
})
