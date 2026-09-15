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
