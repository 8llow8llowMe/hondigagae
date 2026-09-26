import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'
import { readGlobalsCss } from '@/test/tokens'

/**
 * 홈 하단의 `/about` 링크 — 모바일에서 푸터가 빠지며 생겼다.
 *
 * ### 왜 이 줄이 필요한가
 *
 * 768 미만에는 푸터가 없고(`app/globals.css` `.site-footer`), 헤더는 로고·응급·로그인만,
 * 탭바 네 칸 중 둘은 보호 라우트다. **비로그인 모바일 방문자가 데이터 출처에 닿을 수
 * 있는 자리가 여기밖에 없다** — 링크가 사라지면 `/about` 은 주소를 직접 쳐야만 열린다.
 *
 * ### 왜 소스 단언인가
 *
 * `home-view.tsx` 는 `useQuery` 여섯을 부르는 client component 라 `renderToStaticMarkup`
 * 으로 세울 수 없다 (`home-ongoing-heading.test.ts` 머리주석과 같은 이유).
 */
const HOME = source('src/features/home/home-view.tsx')

describe('홈 → /about 진입점', () => {
  it('홈이 /about 링크를 갖는다', () => {
    expect(HOME).toContain('href="/about"')
  })

  /*
    **푸터를 감추는 것과 이 줄은 한 쌍이다.** 한쪽만 되돌리면 모바일에서 출처가 닿을 수
    없는 곳에 남는다 — 두 파일에 걸친 계약이라 여기서 함께 잠근다.
  */
  it('푸터가 빠지는 경계와 짝이 맞는다 — md 미만에만 보인다', () => {
    const link = HOME.slice(HOME.indexOf('href="/about"') - 400, HOME.indexOf('href="/about"'))

    expect(link).toContain('md:hidden')
    expect(readGlobalsCss()).toMatch(
      /@media \(width < 48rem\) \{\s*\.site-footer \{\s*display: none;/,
    )
  })

  /*
    **`Canvas` 안이다.** 바깥에 두면 L0 회색 바닥이 이 줄 위에서 끊기고 그 아래가 흰
    `body` 로 남는다 (`surface.tsx` · `main-layout-surface.test.ts` 가 세운 규칙).
  */
  it('Canvas 안에 둔다 — 바닥 밖으로 나가지 않는다', () => {
    expect(HOME.indexOf('href="/about"')).toBeLessThan(HOME.lastIndexOf('</Canvas>'))
  })
})

/**
 * 비로그인 첫 방문자의 소개 카드 (#950). 아래 링크와 **따로가 아니라 한 쌍이다** — 카드를
 * 닫거나 `/about` 을 한 번 열면 카드는 서지 않고, 그 뒤 모바일의 통로는 위의 링크다.
 */
describe('홈 → /about 소개 카드 (#950)', () => {
  const PAGE = source('app/(main)/(home)/page.tsx')
  const ABOUT_PAGE = source('app/(main)/about/page.tsx')
  const CARD = '{showAboutIntro && <AboutIntroCard />}'

  /* 로그인한 사람은 이미 가입했다. 소개를 본 사람에게 소개로 가는 카드를 다시 보일 까닭이 없다 */
  it('서버가 정한다 — 비로그인이고 소개를 본 적이 없을 때만', () => {
    expect(PAGE).toContain('hasSeenAbout((await cookies()).get(ABOUT_SEEN_COOKIE)?.value)')
    expect(PAGE).toContain('showAboutIntro={!authed && !seenAbout}')
  })

  it('홈이 조건부로 카드를 세운다', () => {
    expect(HOME).toContain(CARD)
  })

  /*
    **첫 카드 아래다.** 홈은 설명 없이 오늘 상태부터 보여 준다(소개 명세 2026-09-15 §1-1) —
    카드가 위로 올라가면 첫 화면이 소개가 되어 그 설계가 뒤집힌다. 골든타임이 첫 카드의
    마지막 블록이고, AI 배너가 그 다음 카드다.
  */
  it('자리 — 골든타임(첫 카드) 뒤, AI 배너 앞', () => {
    const at = HOME.indexOf(CARD)

    expect(HOME.indexOf('<WalkTimesSection')).toBeLessThan(at)
    expect(at).toBeLessThan(HOME.indexOf('messages.home.aiPlanBannerTitle'))
  })

  /* 카드를 닫은 사람은 이 링크로만 `/about` 에 닿는다 — 카드가 생겼다고 링크를 걷지 않는다 */
  it('맨 아래 /about 링크는 그대로 남는다', () => {
    expect(HOME.indexOf('href="/about"')).toBeGreaterThan(HOME.indexOf(CARD))
  })

  it('/about 을 열면 본 것으로 적는다', () => {
    expect(ABOUT_PAGE).toContain('<MarkAboutSeen />')
  })
})
