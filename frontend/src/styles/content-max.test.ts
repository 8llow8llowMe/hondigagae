import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readDesignMd, readGlobalsCss, readTokensCss } from '@/test/tokens'

/**
 * 콘텐츠 컨테이너 회귀 검사 — 이슈 #376.
 *
 * `token-sync.test.ts` 는 **색 토큰만** 본다. 레이아웃 토큰은 기계 동기 대상이 아니라
 * `tokens.css` 와 `DESIGN.md` 가 조용히 갈라질 수 있다. 여기서 그 갈라짐을 잡는다.
 */

const tokens = readTokensCss()
const globals = readGlobalsCss()
const design = readDesignMd()

describe('콘텐츠 컨테이너 — 토큰 (#376)', () => {
  it('--content-max 가 1440px 로 선언돼 있다', () => {
    expect(tokens).toMatch(/--content-max:\s*1440px;/)
  })

  it('1584 에서 레일을 480 으로 넓히던 규칙이 남아 있지 않다', () => {
    // 컨테이너가 1440 에서 멈추므로 99rem(1584) 미디어쿼리는 발동할 수 없다
    expect(tokens).not.toMatch(/--rail-context:\s*480px/)
    expect(tokens).not.toContain('99rem')
  })

  it('--rail-context 는 400 고정이다', () => {
    expect(tokens).toMatch(/--rail-context:\s*400px;/)
  })
})

describe('콘텐츠 컨테이너 — 캡 규칙 (#376)', () => {
  const rule = globals.match(/^\.content-container,\s*\n\.rail-layout\s*\{[^}]*\}/m)?.[0]

  it('.content-container 와 .rail-layout 이 한 규칙에서 캡된다', () => {
    // 값이 두 군데로 갈라지면 헤더 내용과 본문의 좌우 경계가 어긋난다
    expect(rule).toBeDefined()
  })

  it('토큰으로 캡한다 — 리터럴 1440 을 다시 적지 않는다', () => {
    expect(rule).toContain('max-inline-size: var(--content-max)')
    expect(rule).toContain('margin-inline: auto')
  })

  it('캡 규칙이 @media 밖 최상위에 있다', () => {
    /*
      헤더는 lg 미만에서도 이 클래스를 쓰고, 레일의 grid 선언만 lg 안에 남는다.
      최상위 규칙은 들여쓰기가 0 이고 @media 안은 2 다 (prettier 가 강제한다).
    */
    expect(globals).toMatch(/^\.content-container,/m)
  })
})

describe('콘텐츠 컨테이너 — 문서 동기 (#376)', () => {
  it('DESIGN.md §7 레이아웃 토큰 표에 --content-max 가 있다', () => {
    expect(design).toContain('--content-max')
  })

  it('DESIGN.md 에 400 → 480 서술이 남아 있지 않다', () => {
    expect(design).not.toContain('480(1584~)')
    expect(design).not.toContain('좌측만 480까지')
  })
})

/*
  소스를 문자열로 읽어 본다 — `GlobalHeader` 는 client 자식(`NavLinks` · `AccountMenu` ·
  `PetSwitcherSlot`)을 안고 있어 node 환경에서 통째로 렌더하려면 mock 이 여럿 필요하다.
  여기서 지키려는 것은 렌더 결과가 아니라 **어느 요소가 캡을 갖는가** 하나다.
  `token-usage.test.ts` 가 화면 코드를 문자열로 훑는 것과 같은 방식이다.
*/
function repoSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

describe('콘텐츠 컨테이너 — 헤더 (#376)', () => {
  const header = repoSource('src/features/nav/global-header.tsx')

  it('바(<header>)는 캡하지 않는다 — 캡하면 border-b 가 화면 가운데서 끊긴다', () => {
    const barClasses = header.match(/<header className="([^"]*)"/)?.[1]

    expect(barClasses).toBeDefined()
    expect(barClasses).not.toContain('content-container')
  })

  it('안쪽 div 가 content-container 를 쓴다', () => {
    expect(header).toMatch(/<div className="content-container[^"]*"/)
  })

  it('Tailwind arbitrary 로 캡하지 않는다 — eslint noComplexArbitrary', () => {
    expect(header).not.toContain('max-w-[var(')
  })
})
