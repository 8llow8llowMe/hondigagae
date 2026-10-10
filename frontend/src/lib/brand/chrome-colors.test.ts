import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MASK_ICON_COLOR, THEME_COLOR } from '@/lib/brand/chrome-colors'
import { normalizeHex, parseColorTokens, readTokensCss } from '@/test/tokens'

/**
 * 브라우저 크롬 색 ↔ 토큰 동기 검사.
 *
 * `chrome-colors.ts` 는 `<meta>` / `<link>` 속성에 넘길 raw hex 를 들고 있다 — 그 자리는
 * CSS 변수를 해석하지 않아 `var(--brand-500)` 이 무시된다. 그래서 값을 손으로 복제했고,
 * **손으로 맞추기로 한 값은 반드시 갈라진다** (이슈 #50 에서 `tokens.css` 가 `DESIGN.md`
 * 보다 한 세대 뒤처진 채 지나갔다).
 *
 * 사람이 세 파일(`tokens.css` · `chrome-colors.ts` · `site.webmanifest`)을 대조하는 대신
 * `pnpm verify` 가 대조한다.
 */

const tokens = parseColorTokens(readTokensCss())

function readManifest(): { theme_color: string; background_color: string } {
  const path = fileURLToPath(new URL('../../../public/site.webmanifest', import.meta.url))
  return JSON.parse(readFileSync(path, 'utf8')) as {
    theme_color: string
    background_color: string
  }
}

describe('브라우저 크롬 색 — tokens.css 와 같은 값이다', () => {
  it('mask-icon 색이 --brand-500 이다', () => {
    expect(normalizeHex(MASK_ICON_COLOR)).toBe(tokens.get('--brand-500'))
  })

  it('theme-color 가 --bg 다 — 상태바가 헤더 배경과 이어져야 한다', () => {
    expect(normalizeHex(THEME_COLOR)).toBe(tokens.get('--bg'))
  })
})

describe('브라우저 크롬 색 — site.webmanifest 와 같은 값이다', () => {
  /*
    매니페스트가 있는 설치형에서는 매니페스트의 `theme_color` 가 `<meta name="theme-color">`
    를 이긴다. 두 값이 갈리면 **설치 전후로 상태바 색이 바뀐다.**
  */
  it('매니페스트 theme_color 가 metadata 의 themeColor 와 같다', () => {
    expect(normalizeHex(readManifest().theme_color)).toBe(normalizeHex(THEME_COLOR))
  })

  it('매니페스트 background_color 도 --bg 다 — 스플래시가 흰 배경에서 시작한다', () => {
    expect(normalizeHex(readManifest().background_color)).toBe(tokens.get('--bg'))
  })
})
