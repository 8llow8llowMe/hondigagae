import { describe, expect, it } from 'vitest'

import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { errorFieldSelector, hasFieldErrors } from '@/lib/form/focus-first-error'

/*
  **DOM 을 쓰는 `focusFirstError` 는 여기서 검사하지 않는다.** 이 저장소의 vitest 는 node
  환경이라 `querySelector` 가 없다 (`testing-guide.md` §1). 대신 둘로 나눠 지킨다.

   1. 선택자를 만드는 순수 함수 — 여기서 검사한다
   2. 그 선택자가 **문서 순서상** 첫 요소를 돌려준다는 것 — `querySelector` 의 명세이고,
      화면 동작은 `e2e/form-field-errors.spec.ts` 가 실제 브라우저에서 확인한다
*/
describe('errorFieldSelector', () => {
  it('오류가 없으면 null 이다 — 빈 선택자로 querySelector 를 부르면 예외다', () => {
    expect(errorFieldSelector(NO_FORM_ERRORS)).toBeNull()
  })

  it('필드마다 id 와 name 두 갈래를 낸다 — 필드명이 name 에만 있는 컨트롤이 있다', () => {
    expect(errorFieldSelector({ fields: { petId: '반려견을 골라 주세요.' }, form: null })).toBe(
      '[id="petId"], [name="petId"]',
    )
  })

  it('오류 키 전부를 한 선택자로 묶는다 — 그래야 문서 순서상 첫 매칭이 나온다', () => {
    const selector = errorFieldSelector({
      fields: { title: '필수', startDate: '필수', endDate: '필수' },
      form: null,
    })

    expect(selector).toContain('[id="startDate"]')
    expect(selector).toContain('[id="endDate"]')
    expect(selector).toContain('[id="title"]')
  })

  it('선택자를 깨뜨릴 수 있는 필드명은 버린다 — 서버가 준 키는 우리가 지은 이름이 아니다', () => {
    expect(errorFieldSelector({ fields: { 'a"],*': '깨진 키' }, form: null })).toBeNull()

    // 성한 키까지 버리지는 않는다
    expect(errorFieldSelector({ fields: { 'a"],*': '깨진 키', title: '필수' }, form: null })).toBe(
      '[id="title"], [name="title"]',
    )
  })
})

describe('hasFieldErrors', () => {
  it('필드 오류가 없으면 false 다', () => {
    expect(hasFieldErrors(NO_FORM_ERRORS)).toBe(false)
  })

  it('필드로 좁혀지지 않는 폼 오류만 있으면 false 다 — 옮길 포커스 대상이 없다', () => {
    expect(hasFieldErrors({ fields: {}, form: '이메일 또는 비밀번호가 올바르지 않아요.' })).toBe(
      false,
    )
  })

  it('필드 오류가 있으면 true 다', () => {
    expect(hasFieldErrors({ fields: { code: '인증번호가 올바르지 않아요.' }, form: null })).toBe(
      true,
    )
  })
})
