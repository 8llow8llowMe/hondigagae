import { describe, expect, it } from 'vitest'

import { toLoginHref } from '@/features/nav/menu-items'
import { messages } from '@/lib/messages'
import { openingTags, readSourceWithoutComments as source } from '@/test/source'

import { PROTECTED_PATHS } from '../../../proxy'

/**
 * 홈의 AI 일정 생성 배너(#905 R1)와 장소 목록 링크 문구(#905 R7).
 *
 * ### 왜 소스 단언인가
 *
 * `home-view.tsx` 는 `useQuery` 여섯을 부르는 client component 라 `renderToStaticMarkup`
 * 으로 세울 수 없다 (`home-about-link.test.ts` 머리주석과 같은 이유). `Banner` 자체의 렌더는
 * 공통 컴포넌트가 맡고, 여기서는 **홈이 무엇을 어디에 꽂는가**만 잠근다.
 */
const HOME = source('src/features/home/home-view.tsx')

/** 바로가기 줄의 열기 태그 (#1356 — AI 배너가 한 줄 세 칸의 첫 칸이 됐다) */
function shortcutsTag(): string {
  const tag = openingTags(HOME, /<HomeShortcuts\b/g)[0]
  if (tag === undefined) throw new Error('바로가기 줄이 홈에 없다')
  return tag
}

describe('홈 → AI 일정 생성 진입점 (#905 R1 · #1356)', () => {
  it('홈이 /ai-plans/new 로 가는 칸을 넘긴다', () => {
    expect(HOME).toContain("const AI_PLAN_HREF = '/ai-plans/new'")
    expect(shortcutsTag()).toContain('AI_PLAN_HREF')
  })

  /*
    **보호 경로다.** 게스트가 그대로 누르면 proxy 가 `/login` 으로 튕기는데, 홈이 먼저
    `toLoginHref` 로 감싸 두면 로그인 뒤 돌아올 곳(`returnTo`)이 링크에 실린다 — 전역 nav 와
    같은 처리다.
  */
  it('게스트는 로그인을 거친다 — authed 로 갈라 toLoginHref 로 감싼다', () => {
    expect(shortcutsTag()).toContain(
      'aiPlanHref={authed ? AI_PLAN_HREF : toLoginHref(AI_PLAN_HREF)}',
    )
    expect(PROTECTED_PATHS).toContain('/ai-plans')
    expect(toLoginHref('/ai-plans/new')).toBe('/login?returnTo=%2Fai-plans%2Fnew')
  })

  /* 진입점을 숨기지 않는다 — 게스트가 AI 여행 설계의 존재를 알 길이 이 칸이다 */
  it('게스트에게도 보인다 — authed 조건으로 감싸지 않는다', () => {
    const at = HOME.indexOf(shortcutsTag())
    const before = HOME.slice(at - 40, at)

    expect(before).not.toContain('authed &&')
    expect(before).not.toContain('authed ?')
  })

  /*
    **장소 추천 뒤다** (#1356). 배너 셋이 좌측 레일 끝에 있던 때 1024 미만에서는 그 셋이
    `오늘 갈 만한 곳` 보다 먼저 서서 장소 카드가 첫 화면에 들지 못했다.
  */
  it('오늘 갈 만한 곳 뒤에 선다', () => {
    const at = HOME.indexOf(shortcutsTag())

    expect(HOME.indexOf('titleId="suitability-heading"')).toBeLessThan(at)
    expect(HOME.indexOf('<WalkTimesSection')).toBeLessThan(at)
  })

  /* 배너 셋은 걷혔다 — 같은 진입점이 두 벌로 서지 않는다 */
  it('홈에 전폭 배너가 남아 있지 않다', () => {
    expect(HOME).not.toContain('<Banner')
  })

  it('문구가 비어 있지 않다', () => {
    expect(messages.home.aiPlanBannerTitle).toContain('AI')
    expect(messages.home.aiPlanBannerDescription.length).toBeGreaterThan(0)
  })
})

/*
  **#905 R7 — 같은 링크가 폭마다 다른 수를 말하지 않는다.** 예전에는 모바일 버튼이
  `장소 17곳 더 보기`(남은 수), 데스크톱 링크가 `장소 20곳 전체 보기 ›`(전체 수)였다.
*/
describe('홈 → 장소 목록 링크 문구 (#905 R7)', () => {
  /*
    **#1069 이후 링크는 끝 카드 한 장이다** — 모바일 버튼 · 데스크톱 링크 두 벌이 걷혔다.
    그래도 수는 **전체 수**여야 한다: 남은 수로 쓰면 같은 링크가 추천 수에 따라 다른 수를 말한다.
    (끝 카드의 문구 · 꺾쇠는 `place-insight-card.test.ts` 가 잠근다)
  */
  it('끝 카드에 넘기는 수가 전체 장소 수다', () => {
    const end = HOME.indexOf('placeCardsEnd({')

    expect(end).toBeGreaterThan(-1)
    expect(HOME.slice(end, end + 200)).toContain('total: places.length')
    expect(HOME).not.toContain('morePlaces')
  })

  it('남은 수 문구 키가 남아 있지 않다', () => {
    expect(Object.keys(messages.home)).not.toContain('morePlaces')
  })

  /* 목록 아래 버튼 줄 두 개를 걷었다 — 같은 `/places` 링크가 끝 카드와 겹쳐 서지 않는다 */
  it('목록 아래 버튼 줄이 남아 있지 않다', () => {
    expect(HOME).not.toContain('allPlacesLabel')
    expect(HOME).not.toContain('unscoredPlaces')
  })
})
