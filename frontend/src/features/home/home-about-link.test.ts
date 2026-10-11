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
  /** #1356 부터 한 벌이다 — 폭마다 다른 자리라 두던 사본 둘이 한 자리로 모였다 */
  const CARD = '{aboutIntroShown && <AboutIntroCard onDismiss={dismissAboutIntro} />}'

  /* 로그인한 사람은 이미 가입했다. 소개를 본 사람에게 소개로 가는 카드를 다시 보일 까닭이 없다 */
  it('서버가 정한다 — 비로그인이고 소개를 본 적이 없을 때만', () => {
    expect(PAGE).toContain('hasSeenAbout((await cookies()).get(ABOUT_SEEN_COOKIE)?.value)')
    expect(PAGE).toContain('showAboutIntro={!authed && !seenAbout}')
  })

  it('홈이 조건부로 카드를 세운다 — 서버 값과 닫기 상태 둘 다', () => {
    expect(HOME).toContain('const aboutIntroShown = showAboutIntro && !aboutIntroDismissed')
    expect(HOME).toContain(CARD)
  })

  /*
    **한 벌이다** (#1356). #963 은 1024 미만 · 이상의 자리가 달라 `lg:hidden` · `hidden lg:block`
    사본 둘을 두었는데, 좌측 레일이 오늘 요약 카드 한 장이 되면서 두 자리가 DOM 의 한 자리로
    모였다. 폭 클래스가 돌아오면 사본도 함께 돌아온 것이다.
  */
  it('카드는 한 벌이고 폭 클래스가 없다', () => {
    expect(HOME.split('<AboutIntroCard').length - 1).toBe(1)
    expect(HOME).not.toMatch(/<AboutIntroCard className=/)
  })

  /*
    **오늘 상태를 본 다음, 오늘 갈 만한 곳 앞이다** (소개 명세 2026-09-15 §1-1). 우측 열 머리(여행
    배너 다음)라 1024 이상은 첫 화면 안이고, 1024 미만은 좌측 레일(오늘 요약 카드) 바로 다음이다.
    × 뒤 초점은 다음 형제를 믿는다 — 다음 형제가 `오늘 갈 만한 곳` 이어야 한다.
  */
  it('우측 열 머리 — 오늘 요약 카드 뒤, 오늘 갈 만한 곳 바로 앞 형제', () => {
    const at = HOME.indexOf(CARD)
    const rightStack = HOME.indexOf('<SurfaceStack className="lg:pl-3">')
    const next = HOME.indexOf('<Surface', at + CARD.length)

    expect(at).toBeGreaterThan(rightStack)
    expect(at).toBeGreaterThan(HOME.indexOf('<WalkTimesSection'))
    expect(
      HOME.slice(at + CARD.length, next)
        .replace(/\{\}/g, '')
        .trim(),
    ).toBe('')
    expect(HOME.slice(next, HOME.indexOf('>', next))).toContain('titleId="suitability-heading"')
  })

  /*
    **보이는 순서 = DOM 순서다.** 한 벌로 모은 방법은 `display: contents` + `order` 가 아니라 DOM 을
    모바일 우선순위로 다시 짠 것이다 — `order` 로 당기면 키보드 · 스크린리더가 보이는 순서와 다르게
    닿는다(WCAG 1.3.2 · 2.4.3, #963 기각안). 레일 · 스택 클래스가 그대로인지 함께 잠근다.
  */
  it('order · display: contents 로 순서를 당기지 않는다', () => {
    const stacks = [...HOME.matchAll(/<SurfaceStack className="([^"]*)">/g)].map((m) => m[1])

    expect(HOME).toContain('<div className="rail-layout">')
    expect(stacks).toEqual(['lg:sticky lg:top-16 lg:self-start lg:pr-3', 'lg:pl-3'])
    // `border-*` 에 속지 않게 앞 글자를 본다
    expect(HOME).not.toMatch(/(?<![\w-])-?order-(?:first|last|none|\d)/)
    // `display: contents` 유틸리티만 막는다 — `SliceResponse.contents` 같은 필드명에 걸리지 않게 className 안만 본다
    expect(HOME).not.toMatch(/className=\{?["'`][^"'`]*(?<![\w-])(?:\w+:)*contents\b/)
  })

  it('닫기 상태는 HomeView 하나가 갖는다', () => {
    expect(HOME).toContain('const [aboutIntroDismissed, setAboutIntroDismissed] = useState(false)')
    expect(HOME).toMatch(/const dismissAboutIntro = \(\) => setAboutIntroDismissed\(true\)/)
  })

  /* 카드를 닫은 사람은 이 링크로만 `/about` 에 닿는다 — 카드가 생겼다고 링크를 걷지 않는다 */
  it('맨 아래 /about 링크는 그대로 남는다', () => {
    expect(HOME.indexOf('href="/about"')).toBeGreaterThan(HOME.indexOf(CARD))
  })

  it('/about 을 열면 본 것으로 적는다', () => {
    expect(ABOUT_PAGE).toContain('<MarkAboutSeen />')
  })
})
