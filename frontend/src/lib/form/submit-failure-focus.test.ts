import { describe, expect, it } from 'vitest'

import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import {
  resendFocusTargets,
  submitFailureAnnounce,
  submitFailureFocusTargets,
} from '@/lib/form/submit-failure-focus'

/*
  DOM 을 쓰는 `focusSubmitFailure` 는 여기서 검사하지 않는다 — node 환경이다
  (`testing-guide.md` §1). **무엇을 어떤 순서로 시도하는가** 만 순수 함수로 지키고, 실제
  포커스는 `e2e/auth-code-focus.spec.ts` 가 브라우저에서 본다.
*/
describe('submitFailureFocusTargets', () => {
  it('필드 오류가 있으면 첫 오류 필드가 먼저다 — 폼 전체 오류가 함께 있어도', () => {
    expect(
      submitFailureFocusTargets({ fields: { email: '필수' }, form: '잠시 후 다시 시도해 주세요.' }),
    ).toEqual(['field', 'alert', 'input'])
  })

  it('필드 오류만 있으면 필드 → 첫 입력 순이다', () => {
    expect(submitFailureFocusTargets({ fields: { email: '필수' }, form: null })).toEqual([
      'field',
      'input',
    ])
  })

  it('폼 전체 오류(5xx · 429 · MEMBER_007 · 409)만 있으면 알림 → 첫 입력 순이다', () => {
    expect(submitFailureFocusTargets({ fields: {}, form: '요청이 너무 많습니다.' })).toEqual([
      'alert',
      'input',
    ])
  })

  /*
    #1079 — 5xx 에서는 `FormAlert` 가 서지 않고 일시 장애 표시 하나만 선다. 대상이 알림에서
    그 표시로 바뀐다. 알림을 배열에 남기면 찾지 못하고 첫 입력으로 떨어진다 — 그러면 "무엇이
    잘못됐는가" 를 읽기 전에 이메일 칸에서 시작한다.
  */
  it('5xx 면 알림이 아니라 일시 장애 표시 → 첫 입력 순이다', () => {
    expect(
      submitFailureFocusTargets({ fields: {}, form: '잠시 후 다시 시도해 주세요.' }, 503),
    ).toEqual(['temporary', 'input'])
  })

  it('429 는 상태를 넘겨도 알림이다 — 일시 장애가 아니다', () => {
    expect(submitFailureFocusTargets({ fields: {}, form: '요청이 너무 많습니다.' }, 429)).toEqual([
      'alert',
      'input',
    ])
  })

  it('필드 오류는 5xx 에서도 먼저다', () => {
    expect(submitFailureFocusTargets({ fields: { email: '필수' }, form: null }, 0)).toEqual([
      'field',
      'temporary',
      'input',
    ])
  })

  it('보여 줄 오류가 없어도 첫 입력은 남긴다 — 버튼이 disabled 였다 풀리며 BODY 로 떨어지지 않게', () => {
    expect(submitFailureFocusTargets(NO_FORM_ERRORS)).toEqual(['input'])
  })
})

/*
  #1102 — 포커스를 받는 실패 표시가 `role="alert"` 이기도 해서, 알림 낭독과 포커스 이동 낭독이
  같은 문구를 두 번 읽을 수 있었다. 표시가 **포커스를 받으면** 포커스 하나로, 받지 않으면(필드로
  간다) 알림 하나로 읽힌다. 고르는 기준은 위 순서의 첫 대상이다 — 둘이 따로 판정하면 알림을 끈
  표시로 포커스가 안 가 아무것도 읽히지 않는다.
*/
describe('submitFailureAnnounce', () => {
  it('폼 전체 오류만 있으면 포커스가 그 알림으로 간다 → focus', () => {
    expect(submitFailureAnnounce({ fields: {}, form: '요청이 너무 많습니다.' }, 429)).toBe('focus')
  })

  it('5xx · 무응답이면 포커스가 일시 장애 상자로 간다 → focus', () => {
    expect(submitFailureAnnounce({ fields: {}, form: '잠시 후' }, 503)).toBe('focus')
    expect(submitFailureAnnounce(NO_FORM_ERRORS, 0)).toBe('focus')
  })

  it('필드 오류가 있으면 포커스가 필드로 간다 → 알림은 live 로 남는다(반려견 폼 요약)', () => {
    expect(submitFailureAnnounce({ fields: { name: '필수' }, form: '요약' })).toBe('live')
  })

  it('보여 줄 실패가 없으면 live 다 — 기본값과 같다', () => {
    expect(submitFailureAnnounce(NO_FORM_ERRORS)).toBe('live')
  })
})

/*
  #1102 — 가입 · 재설정 2단계의 `다시 보내기` 는 성공해도 429 여도 쿨다운으로 `disabled` 가 된다.
  `submitCount` 경로가 아니라 `focusSubmitFailure` 가 닿지 않았고, 실측(Playwright)에서 성공 ·
  429 · 503 세 갈래 모두 포커스가 `BODY` 였다.
*/
describe('resendFocusTargets', () => {
  it('성공이면 폼의 첫 입력(코드 칸)이다 — 다음 할 일은 새 코드를 넣는 것이다', () => {
    expect(resendFocusTargets('sent', NO_FORM_ERRORS, null)).toEqual(['input'])
  })

  it('성공이면 남은 오류가 있어도 첫 입력이다 — 직전 실패는 낡았다', () => {
    expect(resendFocusTargets('sent', { fields: {}, form: '요청이 너무 많습니다.' }, 429)).toEqual([
      'input',
    ])
  })

  it('429 면 제출 실패와 같은 순서 — 알림 → 첫 입력', () => {
    expect(
      resendFocusTargets('failed', { fields: {}, form: '잠시 후 다시 요청해주세요.' }, 429),
    ).toEqual(['alert', 'input'])
  })

  it('5xx 면 일시 장애 상자 → 첫 입력', () => {
    expect(resendFocusTargets('failed', NO_FORM_ERRORS, 503)).toEqual(['temporary', 'input'])
  })
})
