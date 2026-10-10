import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { CheckboxGroup } from '@/components/checkbox-group'
import { fieldErrorId } from '@/components/field'

const OPTIONS = [
  { value: '1', label: '몽실이', description: '말티즈 · 소형견' },
  { value: '2', label: '초코', description: '리트리버 · 대형견' },
]

function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(CheckboxGroup, {
      id: 'petIds',
      label: '함께 갈 반려견',
      options: OPTIONS,
      values: [],
      onValuesChange: () => undefined,
      ...overrides,
    }),
  )
}

describe('CheckboxGroup — 여러 개를 고른다', () => {
  it('반려견 수만큼 체크박스가 나온다', () => {
    const markup = render()

    expect(markup.split('type="checkbox"').length - 1).toBe(2)
    expect(markup).toContain('몽실이')
    expect(markup).toContain('초코')
  })

  it('여러 개가 동시에 체크된다 — 라디오가 아니다', () => {
    const markup = render({ values: ['1', '2'] })

    expect(markup.split('checked=""').length - 1).toBe(2)
  })

  it('고르지 않은 항목은 체크되지 않는다', () => {
    expect(render({ values: ['1'] }).split('checked=""').length - 1).toBe(1)
  })

  it('선택의 근거인 description 을 숨기지 않는다', () => {
    expect(render()).toContain('말티즈 · 소형견')
  })
})

describe('오류 배선 — RadioGroup 과 같다', () => {
  it('오류는 fieldset 에 aria-invalid 와 aria-describedby 로 붙는다', () => {
    const markup = render({ error: '반려견을 골라 주세요.' })

    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain(`aria-describedby="${fieldErrorId('petIds')}"`)
    expect(markup).toContain('반려견을 골라 주세요.')
  })

  it('오류가 없으면 그 속성들이 없다', () => {
    const markup = render()

    expect(markup).not.toContain('aria-invalid')
    expect(markup).not.toContain('aria-describedby')
  })

  it('그룹 라벨은 legend 다 — 체크박스 그룹은 labelable 이 아니다', () => {
    expect(render()).toContain('<legend')
  })
})

/*
  #1066 — AI 일정 만들기의 `fieldPetHint` 를 라벨 옆 `InfoTip` 으로 옮기며 연 슬롯이다.
  **그룹 이름에 보조 버튼의 이름이 섞이지 않아야** 한다: `<legend>` 안의 내용이 통째로
  fieldset 의 이름이 되므로, 슬롯이 있을 때는 라벨 글자만 `aria-labelledby` 로 가리킨다.
*/
describe('CheckboxGroup — 라벨 옆 trailing 슬롯', () => {
  const TRAILING = createElement('button', { type: 'button', 'aria-label': '선택 기준' }, '?')

  it('슬롯이 없으면 이름을 legend 에 맡긴다 — 기존 동작 그대로', () => {
    expect(render()).not.toContain('aria-labelledby')
  })

  it('슬롯을 legend 안, 라벨 뒤에 그린다', () => {
    const markup = render({ trailing: TRAILING })
    const legend = markup.slice(markup.indexOf('<legend'), markup.indexOf('</legend>'))

    expect(legend).toContain('aria-label="선택 기준"')
    expect(legend.indexOf('함께 갈 반려견')).toBeLessThan(legend.indexOf('aria-label="선택 기준"'))
  })

  it('슬롯이 있으면 그룹 이름은 라벨 글자만 가리킨다', () => {
    const markup = render({ trailing: TRAILING })
    const labelId = /aria-labelledby="([^"]+)"/.exec(markup)?.[1]

    expect(labelId).toBeDefined()
    expect(markup).toContain(`id="${labelId}">함께 갈 반려견</span>`)
  })
})
