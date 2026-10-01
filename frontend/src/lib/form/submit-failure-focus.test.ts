import { describe, expect, it } from 'vitest'

import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { submitFailureFocusTargets } from '@/lib/form/submit-failure-focus'

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
