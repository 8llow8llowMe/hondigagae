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

/** AI 배너의 `<Banner …>` 열기 태그 — 제목 메시지로 집는다 */
function aiBannerTag(): string {
  const tag = openingTags(HOME, /<Banner\b/g).find((banner) =>
    banner.includes('messages.home.aiPlanBannerTitle'),
  )
  if (tag === undefined) throw new Error('AI 일정 생성 배너가 홈에 없다')
  return tag
}

describe('홈 → AI 일정 생성 배너 (#905 R1)', () => {
  it('홈이 /ai-plans/new 로 가는 배너를 갖는다', () => {
    expect(HOME).toContain("const AI_PLAN_HREF = '/ai-plans/new'")
    expect(aiBannerTag()).toContain('AI_PLAN_HREF')
    expect(aiBannerTag()).toContain('messages.home.aiPlanBannerDescription')
  })

  /*
    **보호 경로다.** 게스트가 그대로 누르면 proxy 가 `/login` 으로 튕기는데, 홈이 먼저
    `toLoginHref` 로 감싸 두면 로그인 뒤 돌아올 곳(`returnTo`)이 링크에 실린다 — 전역 nav 와
    같은 처리다.
  */
  it('게스트는 로그인을 거친다 — authed 로 갈라 toLoginHref 로 감싼다', () => {
    expect(aiBannerTag()).toContain('href={authed ? AI_PLAN_HREF : toLoginHref(AI_PLAN_HREF)}')
    expect(PROTECTED_PATHS).toContain('/ai-plans')
    expect(toLoginHref('/ai-plans/new')).toBe('/login?returnTo=%2Fai-plans%2Fnew')
  })

  /* 진입점을 숨기지 않는다 — 게스트가 AI 여행 설계의 존재를 알 길이 이 배너다 */
  it('게스트에게도 보인다 — authed 조건으로 감싸지 않는다', () => {
    const at = HOME.indexOf(aiBannerTag())
    const wrapper = HOME.slice(HOME.lastIndexOf('<Surface>', at) - 40, at)

    expect(wrapper).toContain('<Surface>')
    expect(wrapper).not.toContain('authed &&')
    expect(wrapper).not.toContain('authed ?')
  })

  /* `Banner` 의 아이콘 자리는 danger 색 고정이라 상시 진입점이 경보처럼 읽힌다 */
  it('leading 을 주지 않는다', () => {
    expect(aiBannerTag()).not.toContain('leading')
  })

  /* "오늘 언제 나가나" 다음에 "그럼 일정을 짜 볼까" — 골든타임 아래, 올레 배너 위 */
  it('골든타임 아래, 올레 배너 위에 선다', () => {
    const at = HOME.indexOf(aiBannerTag())

    expect(HOME.indexOf('<WalkTimesSection')).toBeLessThan(at)
    expect(at).toBeLessThan(HOME.indexOf('href="/olle"'))
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
  it('모바일·데스크톱이 같은 문구 하나를 쓴다', () => {
    const label = HOME.indexOf('const allPlacesLabel')

    expect(HOME).not.toContain('morePlaces')
    expect(HOME.slice(label, label + 120)).toContain('String(places.length)')
    expect(HOME.match(/\{allPlacesLabel\}/g)).toHaveLength(2)
  })

  it('남은 수 문구 키가 남아 있지 않다', () => {
    expect(Object.keys(messages.home)).not.toContain('morePlaces')
  })

  /* 버튼은 외형이 누를 수 있다고 이미 말한다 — 꺾쇠는 텍스트 링크에만 장식으로 붙는다 */
  it('꺾쇠는 문구가 아니라 텍스트 링크의 aria-hidden 조각이다', () => {
    const desktop = HOME.slice(HOME.lastIndexOf('{allPlacesLabel}'))

    expect(messages.home.allPlaces).not.toContain('›')
    expect(desktop.slice(0, 80)).toContain('<span aria-hidden>›</span>')
  })
})
