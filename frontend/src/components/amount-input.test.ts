import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AmountInput, type AmountInputProps } from '@/components/amount-input'
import { fieldErrorId } from '@/components/field'
import { readSourceWithoutComments } from '@/test/source'

/**
 * `AmountInput` 의 마크업 계약 — 이슈 #986. 입력 · 붙여넣기 · 지우기 · 커서는
 * `lib/form/grouped-digits.test.ts` 와 `e2e/amount-input.spec.ts` 가 본다 (node 환경에는
 * 입력 이벤트가 없다 — `testing-guide.md` §1).
 */
function render(props: Partial<AmountInputProps> = {}) {
  return renderToStaticMarkup(
    createElement(AmountInput, {
      id: 'budget',
      value: '',
      onValueChange: () => undefined,
      ...props,
    }),
  )
}

describe('AmountInput', () => {
  it('폼 값(숫자만)을 쉼표 표기로 그린다', () => {
    expect(render({ value: '300000' })).toContain('value="300,000"')
    expect(render({ value: '30' })).toContain('value="30"')
  })

  it('빈 값은 빈 입력란이다 — 0 을 채워 넣지 않는다', () => {
    const html = render({ value: '' })
    expect(html).toContain('value=""')
    expect(html).not.toContain('value="0"')
  })

  it('숫자 키패드를 여는 text 입력이다 — type="number" 가 아니다', () => {
    const html = render()
    expect(html).toContain('inputMode="numeric"')
    expect(html).not.toContain('type="number"')
  })

  it('Input 의 오류 배선을 그대로 쓴다', () => {
    const html = render({ invalid: true })
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain(`aria-describedby="${fieldErrorId('budget')}"`)
  })

  it('단위 표기(suffix)를 넘기면 Input 이 그린다', () => {
    expect(render({ value: '30', suffix: '만원' })).toContain('만원')
  })
})

/*
  **사용처를 소스로 잠근다.** 수정 모달(`PlanEditModal`)은 `useQueryClient` 를 들어 node 환경에서
  렌더되지 않는다 — 만들기 폼 · AI 폼은 각자의 렌더 테스트가 `value="300,000"` 을 본다.
  범용 `Input` 으로 되돌아가면 쉼표가 다시 사라진다 (#986 의 원래 결함).
*/
describe('AmountInput — 예산 입력칸 사용처', () => {
  it.each([
    ['src/features/plan/plan-create-form.tsx', 'budget'],
    ['src/features/plan/plan-edit-modal.tsx', 'plan-edit-budget'],
    ['src/features/ai-plan/ai-plan-create-form.tsx', 'budgetManwon'],
  ])('%s 의 #%s 는 AmountInput 이다', (file, id) => {
    const source = readSourceWithoutComments(file)
    expect(source).toMatch(new RegExp(`<AmountInput\\s+id="${id}"`))
    expect(source).not.toMatch(new RegExp(`<Input\\s+id="${id}"`))
  })
})
