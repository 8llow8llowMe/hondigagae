/**
 * 소셜 로그인 버튼의 **브랜드 계약** — 공식 마크 도입 (소셜콜백-세부명세 D8-1 ②).
 *
 * 상호작용(클릭 → `authorize` → 이동)은 이 환경에서 검증할 수 없다(testing-guide.md §1).
 * 여기서 잠그는 것은 **회귀하면 브랜드 가이드나 WCAG 를 어기는 값들**이다 — 사람이
 * 리뷰에서 눈으로 세던 것이고, 눈은 `bg-kakao-bg` 가 `bg-brand-600` 으로 바뀌어도 놓친다.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SocialLoginButtons } from '@/features/auth/social-login-buttons'

const markup = renderToStaticMarkup(createElement(SocialLoginButtons, { returnTo: '/' }))

/** 버튼 하나의 여는 태그부터 닫는 태그까지 — 라벨과 클래스를 같은 조각에서 본다 */
function buttonWith(label: string): string {
  const labelAt = markup.indexOf(label)
  expect(labelAt).toBeGreaterThan(-1)

  const open = markup.lastIndexOf('<button', labelAt)
  return markup.slice(open, markup.indexOf('</button>', labelAt) + '</button>'.length)
}

describe('소셜 로그인 버튼 — 제공자 이름은 텍스트로 남는다 (D6)', () => {
  /*
    마크를 달았다고 라벨을 떼면 D6 *"로고만 두지 않는다"* 를 어긴다. 마크는 `aria-hidden`
    이라 라벨이 사라지면 **접근 가능한 이름 자체가 없는 버튼**이 된다.
  */
  it('두 버튼 다 제공자 이름을 글자로 담는다', () => {
    expect(markup).toContain('카카오 로그인')
    expect(markup).toContain('네이버 로그인')
  })

  it('마크는 이름을 주지 않는다 — 라벨이 이미 말한다', () => {
    const marks = markup.match(/<svg[^>]*>/g) ?? []

    expect(marks).toHaveLength(2)
    for (const mark of marks) {
      expect(mark).toContain('aria-hidden="true"')
      expect(mark).not.toContain('aria-label')
    }
  })
})

describe('소셜 로그인 버튼 — 브랜드 예외는 토큰으로만 (DESIGN.md §2-8)', () => {
  it('카카오는 브랜드 예외 토큰 둘을 쓴다', () => {
    const kakao = buttonWith('카카오 로그인')

    expect(kakao).toContain('bg-kakao-bg')
    expect(kakao).toContain('text-kakao-fg')
  })

  /*
    **이 테스트가 이 파일의 존재 이유다.** Figma 의 기본 변형은 초록 채움 + 흰 글자이고
    그것이 **2.25:1 로 AA 미달**이다 (§2-8 실측). "디자인대로" 돌리는 순간 이 값이
    되살아나므로, 네이버 버튼 배경에 초록이 오는 것을 잠근다 — 초록은 마크에만 산다.
  */
  it('네이버는 초록으로 채우지 않는다 — 흰 배경 변형이다', () => {
    const naver = buttonWith('네이버 로그인')
    const openTag = naver.slice(0, naver.indexOf('>') + 1)

    expect(openTag).not.toContain('naver-mark')
    expect(openTag).toContain('bg-bg')
    expect(openTag).toContain('border-border-strong')
    // 초록은 마크 안에만 있다
    expect(naver).toContain('var(--naver-mark)')
  })

  /* 값을 박으면 토큰과 두 곳으로 갈린다 — 린트가 className 만 보므로 여기서 마크까지 본다 */
  it('마크에 raw 색상값이 없다', () => {
    expect(markup).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
  })
})
