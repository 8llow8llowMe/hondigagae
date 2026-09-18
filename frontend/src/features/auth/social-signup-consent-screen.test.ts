/**
 * 소셜 최초 연동 동의 화면 — 이슈 #707.
 *
 * **이 파일이 잠그는 것은 "무엇이 없는가" 다.** 이 화면의 존재 이유가 회원가입 화면에서
 * 이 사용자에게 해로운 것들을 덜어 내는 것이기 때문이다 — 특히 **들어오지 않은 제공자
 * 버튼**은 누르는 순간 다른 이메일의 다른 가입이 된다. 있으면 안 되는 것은 리뷰에서
 * 눈으로 세기 어렵다.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SocialSignupConsentScreen } from '@/features/auth/social-signup-consent-screen'
import type { OAuthProviderId } from '@/lib/auth/oauth-provider'
import { messages } from '@/lib/messages'

function render(provider: OAuthProviderId, returnTo = '/'): string {
  return renderToStaticMarkup(createElement(SocialSignupConsentScreen, { provider, returnTo }))
}

const kakao = render('kakao')
const naver = render('naver')

describe('소셜 동의 화면 — 들어온 제공자 버튼 하나만 선다', () => {
  it('카카오로 들어오면 카카오 버튼 하나뿐이다', () => {
    expect(kakao).toContain(messages.auth.socialLoginLabel('카카오'))
    expect(kakao).not.toContain(messages.auth.socialLoginLabel('네이버'))
  })

  it('네이버로 들어오면 네이버 버튼 하나뿐이다', () => {
    expect(naver).toContain(messages.auth.socialLoginLabel('네이버'))
    expect(naver).not.toContain(messages.auth.socialLoginLabel('카카오'))
  })

  /*
    라벨만 세면 부족하다 — 제공자 마크만 든 두 번째 버튼이 늘어도 라벨 단언은 통과한다.
    `<button` 의 개수로 "선택지가 하나" 를 직접 잠근다.
  */
  it('버튼 요소 자체가 하나다', () => {
    for (const markup of [kakao, naver]) {
      expect(markup.match(/<button/g) ?? []).toHaveLength(1)
    }
  })
})

describe('소셜 동의 화면 — 회원가입 폼을 데려오지 않는다', () => {
  it('이메일 입력도 인증코드 받기도 없다', () => {
    expect(kakao).not.toContain(messages.auth.emailLabel)
    expect(kakao).not.toContain(messages.auth.sendCode)
    expect(kakao).not.toContain('type="email"')
  })

  it('단계 표시가 없다 — 이메일 가입 흐름의 것이다', () => {
    expect(kakao).not.toContain(messages.auth.stepOf(1, 3))
    expect(kakao).not.toContain('3단계')
  })
})

describe('소셜 동의 화면 — 동의 3종과 그 게이트', () => {
  it('동의 체크박스 3종이 그대로 선다', () => {
    expect(kakao).toContain(messages.auth.consentHeading)
    expect(kakao).toContain(messages.auth.termsConsentLabel)
    expect(kakao).toContain(messages.auth.privacyConsentLabel)
    expect(kakao).toContain(messages.auth.ageConsentLabel)
  })

  /*
    진입 시점의 동의는 비어 있다. **여기서 막지 못하면 되돌릴 수 없다** — `/authorize` 는
    동의가 비어도 성공하고, 거부는 인가코드를 태운 뒤인 콜백에서 일어난다 (#688).
  */
  it('동의가 비어 있으므로 버튼이 잠긴 채로 들어온다', () => {
    expect(kakao).toContain('disabled=""')
    expect(kakao).toContain(messages.auth.socialConsentRequired)
  })
})

describe('소셜 동의 화면 — 제공자를 한 번 더 거치는 이유를 말한다', () => {
  /*
    인가코드가 1회용이라 방금 받은 것으로 재시도할 수 없다. 이 말이 없으면 사용자는
    "또 처음부터" 로 읽는다.
  */
  it('들어온 제공자 이름으로 안내한다', () => {
    expect(kakao).toContain(messages.auth.socialSignupConsentNotice('카카오'))
    expect(naver).toContain(messages.auth.socialSignupConsentNotice('네이버'))
  })

  it('화면 제목이 할 일을 그대로 말한다', () => {
    expect(kakao).toContain(messages.auth.socialSignupConsentTitle)
  })
})
