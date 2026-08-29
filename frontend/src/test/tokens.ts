import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * 토큰 검사용 헬퍼.
 *
 * `DESIGN.md` 는 "모든 대비비는 실측값이다" 라고 선언하지만, 그 실측을 사람이 손으로
 * 다시 계산해 문서를 고쳐야 했다. 실제로 지켜지지 않아 `tokens.css` 가 문서보다
 * 한 세대 뒤처진 채로 지나간 적이 있다 (이슈 #50).
 *
 * 그래서 계산과 대조를 테스트로 옮겼다. 값을 바꾸면 `pnpm verify` 가 잡는다.
 */

function repoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

export function readTokensCss(): string {
  return repoFile('src/styles/tokens.css')
}

export function readDesignMd(): string {
  return repoFile('DESIGN.md')
}

export function readGlobalsCss(): string {
  return repoFile('app/globals.css')
}

/** `--name: #hex;` 선언을 전부 걷는다. 값이 hex 가 아닌 것(radius·shadow)은 제외한다 */
export function parseColorTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>()

  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    const [, name, value] = match
    if (name !== undefined && value !== undefined) tokens.set(name, normalizeHex(value))
  }

  return tokens
}

/** `#abc` 를 `#AABBCC` 로 펴고 대문자로 맞춘다 — 문서와 CSS 의 표기가 다르기 때문이다 */
export function normalizeHex(hex: string): string {
  const body = hex.slice(1)
  const expanded =
    body.length === 3
      ? body
          .split('')
          .map((char) => char + char)
          .join('')
      : body

  return `#${expanded.slice(0, 6).toUpperCase()}`
}

function channelLuminance(channel: number): number {
  const ratio = channel / 255

  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const value = normalizeHex(hex).slice(1)
  const [r, g, b] = [0, 2, 4].map((offset) =>
    channelLuminance(Number.parseInt(value.slice(offset, offset + 2), 16)),
  )

  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

/** WCAG 2.x 명암비. 소수 둘째 자리에서 버린다 — 문서 표기와 같은 단위로 비교하기 위해서다 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const [lighter, darker] = a > b ? [a, b] : [b, a]

  return Math.floor((((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)) * 100) / 100
}
