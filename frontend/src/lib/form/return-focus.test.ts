import { describe, expect, it } from 'vitest'

import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import {
  FORM_SUBMIT_SELECTOR,
  returnFocusSelectors,
  returnFocusTarget,
} from '@/lib/form/return-focus'

/*
  #1295 N2 — 서버가 동의를 거부해 다시 띄운 약관 시트를 Esc 로 닫으면 포커스가 `BODY` 로 떨어졌다.
  시트가 열릴 때 `가입하기` 가 제출 중 `disabled` 라 `useOverlay` 가 기억한 "열기 직전의 활성 요소"
  가 `BODY` 였다. 닫을 때 돌아갈 자리를 폼이 직접 정한다: 첫 오류 칸 → 제출 버튼.

  node 에는 `querySelector` 가 없다 (testing-guide.md §1) — 선택자를 받는 가짜 컨테이너로 순서만 본다.
  실제 브라우저 동작은 `e2e/signup-consent-rejected.spec.ts` 가 잠근다.
*/

function fakeContainer(present: Record<string, string>) {
  return {
    querySelector: (selector: string) => present[selector] ?? null,
  }
}

describe('returnFocusSelectors', () => {
  it('오류가 없으면 제출 버튼 하나다', () => {
    expect(returnFocusSelectors(NO_FORM_ERRORS)).toEqual([FORM_SUBMIT_SELECTOR])
  })

  it('오류 칸이 있으면 그 칸이 먼저, 제출 버튼이 다음이다', () => {
    expect(returnFocusSelectors({ fields: { password: '필수' }, form: null })).toEqual([
      '[id="password"], [name="password"]',
      FORM_SUBMIT_SELECTOR,
    ])
  })

  it('제출 버튼은 폼 안의 살아 있는 것만 고른다 — 비활성 버튼은 포커스를 받지 못한다', () => {
    expect(FORM_SUBMIT_SELECTOR).toBe('form button[type="submit"]:not([disabled])')
  })
})

describe('returnFocusTarget', () => {
  it('첫 오류 칸이 화면에 있으면 그 칸이다', () => {
    const container = fakeContainer({
      '[id="name"], [name="name"]': 'name-input',
      [FORM_SUBMIT_SELECTOR]: 'submit',
    })

    expect(returnFocusTarget(container, { fields: { name: '필수' }, form: null })).toBe(
      'name-input',
    )
  })

  /*
    서버가 거부한 동의 칸(`termsAgreed` 등)은 시트 안에 있어 폼 컨테이너에서 찾히지 않는다 — 그때도
    `BODY` 가 아니라 제출 버튼으로 간다.
  */
  it('오류 칸이 컨테이너에 없으면 제출 버튼이다', () => {
    const container = fakeContainer({ [FORM_SUBMIT_SELECTOR]: 'submit' })

    expect(returnFocusTarget(container, { fields: { termsAgreed: '동의' }, form: null })).toBe(
      'submit',
    )
  })

  it('오류가 없으면 제출 버튼이다', () => {
    expect(
      returnFocusTarget(fakeContainer({ [FORM_SUBMIT_SELECTOR]: 'submit' }), NO_FORM_ERRORS),
    ).toBe('submit')
  })

  it('둘 다 없거나 컨테이너가 없으면 null — 열기 직전의 활성 요소로 돌아가게 둔다', () => {
    expect(returnFocusTarget(fakeContainer({}), NO_FORM_ERRORS)).toBeNull()
    expect(returnFocusTarget(null, NO_FORM_ERRORS)).toBeNull()
  })
})
