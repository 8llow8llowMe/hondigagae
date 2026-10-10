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
  /** 좌측 레일 사본 — 1024 미만에서만 보인다 */
  const RAIL_CARD = '<AboutIntroCard className="lg:hidden" onDismiss={dismissAboutIntro} />'
  /** 우측 열 사본 — 1024 이상에서만 보인다 */
  const MAIN_CARD = '<AboutIntroCard className="hidden lg:block" onDismiss={dismissAboutIntro} />'
  const GUARD = '{aboutIntroShown && ('

  /** 사본을 감싼 조건식이 시작하는 자리 — 조건 없이 서는 사본이면 -1 */
  function guarded(card: string): number {
    const at = HOME.indexOf(card)
    const guard = HOME.lastIndexOf(GUARD, at)
    if (at < 0 || guard < 0) return -1
    return HOME.slice(guard + GUARD.length, at).trim() === '' ? guard : -1
  }

  /* 로그인한 사람은 이미 가입했다. 소개를 본 사람에게 소개로 가는 카드를 다시 보일 까닭이 없다 */
  it('서버가 정한다 — 비로그인이고 소개를 본 적이 없을 때만', () => {
    expect(PAGE).toContain('hasSeenAbout((await cookies()).get(ABOUT_SEEN_COOKIE)?.value)')
    expect(PAGE).toContain('showAboutIntro={!authed && !seenAbout}')
  })

  it('홈이 조건부로 카드를 세운다 — 서버 값과 닫기 상태 둘 다', () => {
    expect(HOME).toContain('const aboutIntroShown = showAboutIntro && !aboutIntroDismissed')
    expect(guarded(RAIL_CARD)).toBeGreaterThan(-1)
    expect(guarded(MAIN_CARD)).toBeGreaterThan(-1)
  })

  /*
    **두 자리, 보이는 쪽만** (#963). 1024 이상은 우측 권역 카드 아래(좌측 첫 카드가 약 720px 이라
    그 아래면 1024×768 · 1280×800 첫 화면 밖이었다), 미만은 첫 카드 아래다. 숨은 쪽은
    `display: none` 이라 탭 순서 · 접근성 트리에서 빠진다 — 사본이 둘이어도 두 번 서지 않는다.
  */
  it('사본은 둘 — 좌 1024 미만 · 우 1024 이상', () => {
    expect(HOME.split('<AboutIntroCard').length - 1).toBe(2)
  })

  /*
    **1024 미만은 develop 과 같은 DOM 이다.** 첫 카드(골든타임이 마지막 블록) 바로 다음 형제가
    소개 카드이고 그다음이 AI 배너다 — 보이는 순서 = DOM 순서라 키보드 · 스크린리더가 판정 다음에
    곧바로 카드에 닿는다(WCAG 1.3.2 · 2.4.3). × 뒤 초점도 이 순서를 믿는다.
  */
  it('좌 사본 — 첫 카드 바로 다음 형제, AI 배너 앞', () => {
    const at = guarded(RAIL_CARD)
    const firstCardEnd = HOME.indexOf('</Surface>', HOME.indexOf('<WalkTimesSection'))
    const between = HOME.slice(firstCardEnd + '</Surface>'.length, at)

    // 걷힌 JSX 주석은 `{}` 로 남는다
    expect(between.replace(/\{\}/g, '').trim()).toBe('')
    expect(at).toBeLessThan(HOME.indexOf('messages.home.aiPlanBannerTitle'))
  })

  /* **오늘 상태를 본 다음이다** (소개 명세 2026-09-15 §1-1) — 권역도 오늘 상태다 */
  it('우 사본 — 권역 카드 바로 다음 형제, 오늘 갈 만한 곳 앞', () => {
    const at = guarded(MAIN_CARD)
    const regional = HOME.indexOf('<RegionalWeatherSection')
    const regionalEnd = HOME.indexOf('/>', regional) + '/>'.length
    const suitability = HOME.indexOf('<Surface', at)

    expect(HOME.slice(regionalEnd, at).replace(/\{\}/g, '').trim()).toBe('')
    expect(HOME.slice(suitability, HOME.indexOf('>', suitability))).toContain(
      'titleId="suitability-heading"',
    )
  })

  /*
    **1024 미만 레이아웃은 손대지 않는다.** 카드를 한 벌로 두려고 두 스택을 `display: contents`
    로 풀고 `order` 로 당기는 안을 한 번 구현했다가 걷었다 — DOM 순서가 보이는 순서와 갈리고
    홈 전체 간격이 바뀌었다. 레일 · 스택 · 첫 카드의 클래스가 develop 그대로인지 잠근다.
  */
  it('1024 미만 레이아웃 클래스는 그대로다', () => {
    const stacks = [...HOME.matchAll(/<SurfaceStack className="([^"]*)">/g)].map((m) => m[1])

    expect(HOME).toContain('<div className="rail-layout">')
    expect(stacks).toEqual(['lg:sticky lg:top-16 lg:self-start lg:pr-3', 'lg:pl-3'])
    // `border-*` 에 속지 않게 앞 글자를 본다
    expect(HOME).not.toMatch(/(?<![\w-])-?order-(?:first|last|none|\d)/)
    // `display: contents` 유틸리티만 막는다 — `SliceResponse.contents` 같은 필드명에 걸리지 않게 className 안만 본다
    expect(HOME).not.toMatch(/className=\{?["'`][^"'`]*(?<![\w-])(?:\w+:)*contents\b/)
  })

  /*
    **닫기는 한 상태다** — 한쪽 × 가 다른 쪽도 치운다. 사본마다 상태를 가지면 닫은 뒤 창을
    1024 너머로 바꾸는 순간 숨어 있던 사본이 선다.
  */
  it('두 사본이 닫기 상태 하나를 나눠 쓴다', () => {
    expect(HOME).toContain('const [aboutIntroDismissed, setAboutIntroDismissed] = useState(false)')
    expect(HOME).toMatch(/const dismissAboutIntro = \(\) => setAboutIntroDismissed\(true\)/)
    expect(HOME.split('onDismiss={dismissAboutIntro}').length - 1).toBe(2)
  })

  /* 카드를 닫은 사람은 이 링크로만 `/about` 에 닿는다 — 카드가 생겼다고 링크를 걷지 않는다 */
  it('맨 아래 /about 링크는 그대로 남는다', () => {
    expect(HOME.indexOf('href="/about"')).toBeGreaterThan(HOME.indexOf(MAIN_CARD))
  })

  it('/about 을 열면 본 것으로 적는다', () => {
    expect(ABOUT_PAGE).toContain('<MarkAboutSeen />')
  })
})
