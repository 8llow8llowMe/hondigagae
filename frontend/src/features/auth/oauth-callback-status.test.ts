import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { OAuthCallbackStatus } from '@/features/auth/oauth-callback-view'
import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'

function render(provider: string, exchange: Parameters<typeof OAuthCallbackStatus>[0]['exchange']) {
  return renderToStaticMarkup(createElement(OAuthCallbackStatus, { provider, exchange }))
}

/** 도메인 오류는 resultMessage 가 문자열로 온다 */
function domainError(status: number, resultCode: string, message: string) {
  return new ApiError(status, resultCode, message)
}

describe('OAuthCallbackStatus', () => {
  it('교환 중임을 role=status 로 알린다 — 저절로 바뀌는 화면이다', () => {
    const markup = render('kakao', { status: 'exchanging' })

    expect(markup).toContain('role="status"')
    expect(markup).toContain(messages.auth.oauthExchanging)
  })

  it('code·state 가 없으면 교환하지 않고 잘못된 접근을 안내한다', () => {
    const markup = render('kakao', { status: 'invalid' })

    expect(markup).toContain(messages.auth.oauthInvalidTitle)
    expect(markup).toContain(messages.auth.oauthInvalidDescription)
    expect(markup).toContain('href="/login"')
  })

  it('AUTH_008 은 서버 문구를 그대로 낸다 — 어느 소셜인지 서버가 말한다', () => {
    const markup = render('naver', {
      status: 'failed',
      error: domainError(
        409,
        'AUTH_008',
        '이미 카카오(으)로 가입된 계정입니다. 해당 소셜 로그인을 이용해주세요.',
      ),
    })

    expect(markup).toContain('이미 카카오(으)로 가입된 계정입니다.')
    // 같은 소셜을 다시 눌러도 결과가 같으므로 "다시 시도" 로 안내하지 않는다
    expect(markup).toContain(messages.auth.toLogin)
    expect(markup).not.toContain(messages.auth.socialRetryLabel('네이버'))
  })

  it('동의가 필요하면 제공자 이름이 든 버튼을 준다', () => {
    const markup = render('kakao', {
      status: 'failed',
      error: domainError(400, 'AUTH_009', '소셜 계정의 이메일 제공 동의가 필요합니다.'),
    })

    expect(markup).toContain('소셜 계정의 이메일 제공 동의가 필요합니다.')
    expect(markup).toContain(messages.auth.socialRetryLabel('카카오'))
  })

  it('모르는 provider 로 들어와도 라벨이 깨지지 않는다', () => {
    // 경로 세그먼트는 사용자가 조작할 수 있다. 이름을 못 찾으면 일반 문구로 떨어진다
    const markup = render('toString', {
      status: 'failed',
      error: domainError(400, 'AUTH_009', '소셜 계정의 이메일 제공 동의가 필요합니다.'),
    })

    expect(markup).toContain(messages.common.retry)
    expect(markup).not.toContain('function')
  })

  it('state 만료(AUTH_010)는 처음부터 다시다', () => {
    const markup = render('kakao', {
      status: 'failed',
      error: domainError(
        401,
        'AUTH_010',
        '유효하지 않은 소셜 로그인 요청입니다. 처음부터 다시 시도해주세요.',
      ),
    })

    expect(markup).toContain('유효하지 않은 소셜 로그인 요청입니다.')
    expect(markup).toContain(messages.common.retry)
  })

  it('AUTH_014(502)도 서버 문구가 살아남는다 — 일시 장애 문구로 덮이지 않는다', () => {
    const markup = render('kakao', {
      status: 'failed',
      error: domainError(
        502,
        'AUTH_014',
        '소셜 로그인 제공자와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.',
      ),
    })

    // 5xx 경로(FormAlert)로 가지만 문구는 서버 것이다
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('소셜 로그인 제공자와 통신할 수 없습니다.')
  })

  it('문구 없는 5xx 는 일시 장애 문구로 떨어진다', () => {
    const markup = render('kakao', { status: 'failed', error: new ApiError(500, null, null) })

    expect(markup).toContain(messages.common.temporaryErrorDescription)
  })

  /*
    **동의 누락만 목적지가 /signup 이다** (#688). 로그인 화면으로 돌려보내면 그쪽
    소셜 버튼은 동의를 싣지 않아 같은 실패를 그대로 반복한다 — 인가코드가 1회용이라
    사용자는 제공자 인가 화면부터 매번 다시 밟게 된다.
  */
  it('MEMBER_010 은 회원가입 화면으로 보내고 서버 사유를 그대로 보여준다', () => {
    const markup = render('kakao', {
      status: 'failed',
      error: domainError(
        400,
        'MEMBER_010',
        '이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.',
      ),
    })

    expect(markup).toContain('이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.')
    expect(markup).toContain('href="/signup"')
    expect(markup).toContain(messages.auth.toSignupConsent)
  })

  it('MEMBER_011 도 같은 곳으로 보낸다', () => {
    const markup = render('naver', {
      status: 'failed',
      error: domainError(400, 'MEMBER_011', '만 14세 이상만 가입할 수 있습니다.'),
    })

    expect(markup).toContain('만 14세 이상만 가입할 수 있습니다.')
    expect(markup).toContain('href="/signup"')
  })

  it('ApiError 가 아닌 실패도 다음 행동을 준다', () => {
    const markup = render('kakao', { status: 'failed', error: new Error('boom') })

    expect(markup).toContain(messages.auth.oauthFailedTitle)
    expect(markup).toContain('href="/login"')
  })
})
