import { toPlainText } from '@/lib/place/text'

/**
 * `homepage` 는 **HTML anchor 를 포함한 원문**이다 (백엔드 PlaceEntity 주석).
 * href 만 뽑아 안전한 링크로 만든다 — 원문을 HTML 로 렌더하지 않는다.
 */
export type Homepage = {
  href: string
  /** 화면 표시용. 긴 URL 전체 대신 호스트만 보여준다 */
  label: string
}

const ANCHOR_HREF = /<a[^>]*\shref\s*=\s*["']([^"']+)["']/i

/** 스킴이 없는 도메인 표기 (`www.jeju.go.kr`) */
const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)+(\/.*)?$/

export function parseHomepage(raw: string | null): Homepage | null {
  if (raw === null) return null

  const trimmed = raw.trim()
  if (trimmed.length === 0) return null

  // anchor 가 여러 개면 첫 번째만 쓴다. 원천에 링크가 여러 줄 들어 있는 경우가 있다
  const candidate = ANCHOR_HREF.exec(trimmed)?.[1] ?? toPlainText(trimmed)
  if (candidate === null) return null

  const href = toSafeUrl(candidate.trim())
  if (href === null) return null

  return { href, label: new URL(href).host }
}

/**
 * **`http` / `https` 만 허용한다.** `javascript:` `data:` 를 그대로 href 에 넣으면
 * 클릭이 스크립트 실행이 된다.
 */
function toSafeUrl(value: string): string | null {
  const withScheme = BARE_DOMAIN.test(value) ? `https://${value}` : value

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  return parsed.toString()
}
