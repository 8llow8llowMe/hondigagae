import { describe, expect, it } from 'vitest'

import { NO_RESPONSE_STATUS } from '@/lib/api/error'
import { formFailureDisplay } from '@/lib/form/form-failure-display'

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
