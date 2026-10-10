import { describe, expect, it } from 'vitest'

import { NO_RESPONSE_STATUS } from '@/lib/api/error'
import { formErrorsAfterEdit, formFailureDisplay } from '@/lib/form/form-failure-display'

describe('formFailureDisplay', () => {
  it('5xx 면 일시 장애 하나만 선다 — 서버 문구 알림을 함께 세우지 않는다 (#1079)', () => {
    expect(formFailureDisplay('서비스를 일시적으로 사용할 수 없습니다.', 503)).toEqual({
      kind: 'temporary',
    })
  })

  it('무응답(0)도 일시 장애다', () => {
    expect(formFailureDisplay('잠시 후 다시 시도해 주세요.', NO_RESPONSE_STATUS)).toEqual({
      kind: 'temporary',
    })
  })

  it('5xx 는 폼 문구가 없어도 일시 장애다 — 판정은 상태 코드가 한다', () => {
    expect(formFailureDisplay(null, 500)).toEqual({ kind: 'temporary' })
  })

  it('429 는 알림이다 — 재시도 버튼이 잠금을 연장한다', () => {
    expect(formFailureDisplay('로그인 시도가 너무 많습니다.', 429)).toEqual({
      kind: 'alert',
      message: '로그인 시도가 너무 많습니다.',
    })
  })

  it('상태 없이 문구만 있으면 알림이다 — 되돌림 안내 · 클라이언트가 실은 문구', () => {
    expect(formFailureDisplay('코드가 만료됐어요.', null)).toEqual({
      kind: 'alert',
      message: '코드가 만료됐어요.',
    })
  })

  it('문구도 일시 장애도 없으면 아무것도 서지 않는다', () => {
    expect(formFailureDisplay(null, null)).toEqual({ kind: 'none' })
    expect(formFailureDisplay(null, 400)).toEqual({ kind: 'none' })
  })
})

/*
  #1102 — 5xx 뒤 값을 고치면 호출부가 `errorStatus` 를 비운다. 그런데 `errors.form`(서버 문구)이
  남아 있어 `formFailureDisplay(문구, null)` 이 알림을 세웠다: 일시 장애가 서버 문구 알림으로
  **바뀌어** 보였다. 표시 판정만으로는 못 고친다 — `(문구, null)` 은 "401 뒤 값을 고쳤다"(알림을
  남겨야 한다)와 같은 입력이다. 그래서 값을 고치는 순간 문구를 함께 걷는다.
*/
describe('formErrorsAfterEdit', () => {
  const SERVER_5XX = '서비스를 일시적으로 사용할 수 없습니다.'

  it('일시 장애였으면 폼 전체 문구를 걷는다 — 재시도 전까지 아무것도 서지 않는다', () => {
    const next = formErrorsAfterEdit({ fields: {}, form: SERVER_5XX }, 503)

    expect(next).toEqual({ fields: {}, form: null })
    expect(formFailureDisplay(next.form, null)).toEqual({ kind: 'none' })
  })

  it('무응답(0)도 같다', () => {
    expect(
      formErrorsAfterEdit({ fields: {}, form: '잠시 후 다시 시도해 주세요.' }, NO_RESPONSE_STATUS),
    ).toEqual({ fields: {}, form: null })
  })

  it('필드 오류는 건드리지 않는다 — 고친 필드만 지우는 것은 setValue 의 몫이다', () => {
    expect(formErrorsAfterEdit({ fields: { name: '필수' }, form: SERVER_5XX }, 500)).toEqual({
      fields: { name: '필수' },
      form: null,
    })
  })

  it.each([
    { name: '401 — 값을 고쳐도 알림이 남는다(지금 동작)', status: 401 },
    { name: '429', status: 429 },
    { name: '409', status: 409 },
    { name: '상태 없음 — 되돌림 안내', status: null },
  ])('$name: 알림은 그대로다 (같은 객체)', ({ status }) => {
    const errors = { fields: {}, form: '입력을 확인해 주세요.' }

    expect(formErrorsAfterEdit(errors, status)).toBe(errors)
  })

  it('걷을 문구가 없으면 같은 객체를 돌려준다 — setState 가 렌더를 건너뛴다', () => {
    const errors = { fields: {}, form: null }

    expect(formErrorsAfterEdit(errors, 503)).toBe(errors)
  })
})
