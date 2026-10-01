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
    expect(markup).toContain(`>${messages.auth.oauthToLoginScreen}</a>`)
  })

  it('AUTH_008 은 서버 문구를 그대로 낸다 — 어느 소셜인지 서버가 말한다', () => {
    const markup = render('naver', {
      status: 'failed',
      returnTo: '/',
      error: domainError(
        409,
        'AUTH_008',
        '이미 카카오(으)로 가입된 계정입니다. 해당 소셜 로그인을 이용해주세요.',
      ),
    })

    expect(markup).toContain('이미 카카오(으)로 가입된 계정입니다.')
    // 같은 소셜을 다시 눌러도 결과가 같으므로 "다시 시도" 로 안내하지 않는다
    expect(markup).toContain(messages.auth.oauthToLoginScreen)
    expect(markup).not.toContain(messages.common.retry)
  })

  /*
    #1079 — 예전 라벨은 "카카오 다시 시도" 였는데 목적지는 `/login` 이었다. 누르면 제공자가
    아니라 로그인 화면이 떠 라벨이 거짓이 됐다. authorize 를 여기서 다시 부르지 않는다는 기본
    결정이라 라벨을 목적지에 맞췄다.
  */
  it('동의가 필요해도 버튼은 목적지대로 "로그인 화면으로" 다 — 서버 문구가 사유를 말한다', () => {
    const markup = render('kakao', {
      status: 'failed',
      returnTo: '/',
      error: domainError(400, 'AUTH_009', '소셜 계정의 이메일 제공 동의가 필요합니다.'),
    })

    expect(markup).toContain('소셜 계정의 이메일 제공 동의가 필요합니다.')
    expect(markup).toContain('href="/login"')
    expect(markup).toContain(`>${messages.auth.oauthToLoginScreen}</a>`)
    expect(markup).not.toContain('카카오 다시 시도')
  })

  it('모르는 provider 로 들어와도 라벨이 깨지지 않는다', () => {
    // 경로 세그먼트는 사용자가 조작할 수 있다. 이름을 못 찾으면 일반 문구로 떨어진다
    const markup = render('toString', {
      status: 'failed',
      returnTo: '/',
      error: domainError(400, 'AUTH_009', '소셜 계정의 이메일 제공 동의가 필요합니다.'),
    })

    expect(markup).toContain(messages.auth.oauthToLoginScreen)
    expect(markup).not.toContain('function')
  })

  it('state 만료(AUTH_010)는 처음부터 다시다', () => {
    const markup = render('kakao', {
      status: 'failed',
      returnTo: '/',
      error: domainError(
        401,
        'AUTH_010',
        '유효하지 않은 소셜 로그인 요청입니다. 처음부터 다시 시도해주세요.',
      ),
    })

    expect(markup).toContain('유효하지 않은 소셜 로그인 요청입니다.')
    expect(markup).toContain(messages.auth.oauthToLoginScreen)
  })

  it('AUTH_014(502)도 서버 문구가 살아남는다 — 일시 장애 문구로 덮이지 않는다', () => {
    const markup = render('kakao', {
      status: 'failed',
      returnTo: '/',
      error: domainError(
        502,
        'AUTH_014',
        '소셜 로그인 제공자와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.',
      ),
    })

    expect(markup).toContain('소셜 로그인 제공자와 통신할 수 없습니다.')
  })

  /*
    #1079 — 예전에는 5xx 만 제목 없이 `FormAlert` + "다시 시도"(실제로는 `/login` 링크)였다.
    다른 실패와 같은 모양(제목 · 사유 · 로그인 화면으로)으로 맞춘다. 콜백에서 재시도할 수단이
    없으므로(`code` 1회용) `ErrorState` 가 아니다.
  */
  it('5xx 도 "로그인하지 못했어요" 제목과 로그인 화면 링크다 — 알림 상자가 아니다', () => {
    const markup = render('kakao', {
      status: 'failed',
      returnTo: '/',
      error: domainError(502, 'AUTH_014', '소셜 로그인 제공자와 통신할 수 없습니다.'),
    })

    expect(markup).toContain(`>${messages.auth.oauthFailedTitle}</h1>`)
    expect(markup).not.toContain('role="alert"')
    expect(markup).toContain('href="/login"')
    expect(markup).toContain(`>${messages.auth.oauthToLoginScreen}</a>`)
  })

  it.each([
    { name: '잘못된 접근', exchange: { status: 'invalid' } as const },
    {
      name: '도메인 실패',
      exchange: {
        status: 'failed',
        returnTo: '/',
        error: domainError(400, 'AUTH_009', '소셜 계정의 이메일 제공 동의가 필요합니다.'),
      } as const,
    },
    {
      name: '5xx',
      exchange: { status: 'failed', returnTo: '/', error: new ApiError(500, null, null) } as const,
    },
  ])(
    '$name — 제목이 화면의 h1 이고 인증 카드 안에서 여백을 한 번 더 먹지 않는다 (#1079)',
    ({ exchange }) => {
      const markup = render('kakao', exchange)

      expect(markup.match(/<h1/g)).toHaveLength(1)
      expect(markup).not.toContain('<h2')
      // 카드(`px-4 py-6 md:px-5`)가 이미 여백을 갖는다 — 예전에는 제목이 x=49(다른 화면 33)였다
      expect(markup).not.toContain('py-12')
      expect(markup).not.toContain('md:px-10')
    },
  )

  it('문구 없는 5xx 는 일시 장애 문구로 떨어진다', () => {
    const markup = render('kakao', {
      status: 'failed',
      error: new ApiError(500, null, null),
      returnTo: '/',
    })

    expect(markup).toContain(messages.common.temporaryErrorDescription)
  })

  /*
    **동의 누락만 목적지가 다르다** (#688). 로그인 화면으로 돌려보내면 그쪽 소셜 버튼은
    동의를 싣지 않아 같은 실패를 그대로 반복한다 — 인가코드가 1회용이라 사용자는 제공자
    인가 화면부터 매번 다시 밟게 된다.

    **그 목적지가 `/signup` 에서 `/signup/social/{provider}` 로 바뀌었다** (#707).
    제공자를 실어 보내지 않으면 도착한 화면이 버튼을 하나로 좁힐 수 없다.
  */
  it('MEMBER_010 은 들어온 제공자의 동의 화면으로 보내고 서버 사유를 그대로 보여준다', () => {
    const markup = render('kakao', {
      status: 'failed',
      returnTo: '/',
      error: domainError(
        400,
        'MEMBER_010',
        '이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.',
      ),
    })

    expect(markup).toContain('이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.')
    expect(markup).toContain('href="/signup/social/kakao"')
    expect(markup).toContain(messages.auth.toSignupConsent)
  })

  /*
    원래 가려던 곳을 동의 화면까지 들고 간다. 안 들고 가면 `/login?returnTo=/plans`
    로 시작한 사용자가 동의 누락으로 여기 온 뒤 가입을 마쳤을 때 목적지를 잃는다.
  */
  it('복귀 경로가 있으면 동의 화면 링크에 실어 보낸다', () => {
    const markup = render('kakao', {
      status: 'failed',
      returnTo: '/plans',
      error: domainError(400, 'MEMBER_010', '동의가 필요합니다.'),
    })

    expect(markup).toContain('href="/signup/social/kakao?returnTo=%2Fplans"')
  })

  it("복귀 경로가 '/' 면 쿼리를 붙이지 않는다", () => {
    const markup = render('kakao', {
      status: 'failed',
      returnTo: '/',
      error: domainError(400, 'MEMBER_010', '동의가 필요합니다.'),
    })

    expect(markup).toContain('href="/signup/social/kakao"')
    expect(markup).not.toContain('returnTo')
  })

  it('MEMBER_011 도 같은 곳으로 보낸다 — 제공자만 갈린다', () => {
    const markup = render('naver', {
      status: 'failed',
      returnTo: '/',
      error: domainError(400, 'MEMBER_011', '만 14세 이상만 가입할 수 있습니다.'),
    })

    expect(markup).toContain('만 14세 이상만 가입할 수 있습니다.')
    expect(markup).toContain('href="/signup/social/naver"')
  })

  /*
    경로 세그먼트는 사용자가 조작할 수 있다. 그 값을 그대로 이어 붙이면 **곧바로 404 인
    주소**로 안내하게 되므로, 제공자를 특정하지 못하면 회원가입 화면의 동의 블록으로
    떨어진다 (#707). 라벨이 일반 문구로 떨어지는 것과 같은 처리다.
  */
  it('모르는 provider 로 동의 누락이 오면 회원가입 화면으로 떨어진다', () => {
    const markup = render('toString', {
      status: 'failed',
      returnTo: '/plans',
      error: domainError(400, 'MEMBER_010', '동의가 필요합니다.'),
    })

    expect(markup).toContain('href="/signup?returnTo=%2Fplans"')
    expect(markup).not.toContain('/signup/social')
  })

  it('ApiError 가 아닌 실패도 다음 행동을 준다', () => {
    const markup = render('kakao', { status: 'failed', error: new Error('boom'), returnTo: '/' })

    expect(markup).toContain(messages.auth.oauthFailedTitle)
    expect(markup).toContain('href="/login"')
  })
})
