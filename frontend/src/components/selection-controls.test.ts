import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Checkbox } from '@/components/checkbox'
import { fieldErrorId } from '@/components/field'
import { RadioGroup } from '@/components/radio-group'

const sizeOptions = [
  { value: 'SMALL', label: '소형견', description: '체중 10kg 미만' },
  { value: 'MEDIUM', label: '중형견', description: '체중 10kg 이상 25kg 미만' },
  { value: 'LARGE', label: '대형견', description: '체중 25kg 이상' },
] as const

function radio(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(RadioGroup, {
      id: 'sizeType',
      label: '크기',
      options: sizeOptions,
      value: 'SMALL',
      onValueChange: () => undefined,
      ...props,
    }),
  )
}

describe('RadioGroup', () => {
  it('fieldset / legend 로 그룹 라벨을 만든다 — 그룹은 label htmlFor 로 가리킬 수 없다', () => {
    const markup = radio()

    expect(markup).toContain('<fieldset')
    expect(markup).toContain('<legend')
    expect(markup).toContain('크기')
  })

  it('선택지의 description 을 함께 렌더한다 — 선택의 근거다', () => {
    const markup = radio()

    expect(markup).toContain('체중 10kg 미만')
    expect(markup).toContain('체중 10kg 이상 25kg 미만')
    expect(markup).toContain('체중 25kg 이상')
  })

  it('모든 radio 가 같은 name 을 공유한다', () => {
    const markup = radio()

    expect(markup.match(/name="sizeType"/g)).toHaveLength(3)
  })

  it('value 와 일치하는 항목만 checked 다', () => {
    const markup = radio({ value: 'MEDIUM' })

    expect(markup.match(/checked=""/g)).toHaveLength(1)
    expect(markup).toContain('id="sizeType-MEDIUM"')
  })

  it('각 항목의 label htmlFor 가 자기 input id 를 가리킨다', () => {
    const markup = radio()

    for (const option of sizeOptions) {
      expect(markup).toContain(`for="sizeType-${option.value}"`)
      expect(markup).toContain(`id="sizeType-${option.value}"`)
    }
  })

  it('오류가 있으면 메시지를 오류 id 로 렌더하고 aria 를 배선한다', () => {
    const markup = radio({ error: '크기 구분은 필수입니다.' })

    expect(markup).toContain(`id="${fieldErrorId('sizeType')}"`)
    expect(markup).toContain(`aria-describedby="${fieldErrorId('sizeType')}"`)
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('크기 구분은 필수입니다.')
  })

  it('오류가 없으면 오류 요소와 aria 속성을 렌더하지 않는다', () => {
    const markup = radio()

    expect(markup).not.toContain(fieldErrorId('sizeType'))
    expect(markup).not.toContain('aria-invalid')
  })

  it('required 면 별표를 aria-hidden 으로 붙인다', () => {
    const markup = radio({ required: true })

    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('*')
  })

  it('description 이 null 인 선택지는 설명을 렌더하지 않는다', () => {
    const markup = radio({
      options: [{ value: 'SMALL', label: '소형견', description: null }],
    })

    expect(markup).toContain('소형견')
    expect(markup).not.toContain('text-caption')
  })
})

function checkbox(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(Checkbox, {
      id: 'heatSensitive',
      label: '더위에 민감해요',
      checked: false,
      onCheckedChange: () => undefined,
      ...props,
    }),
  )
}

describe('Checkbox', () => {
  it('라벨을 자기 input 에 연결한다', () => {
    const markup = checkbox()

    expect(markup).toContain('for="heatSensitive"')
    expect(markup).toContain('id="heatSensitive"')
    expect(markup).toContain('더위에 민감해요')
  })

  it('checked 를 반영한다', () => {
    expect(checkbox({ checked: true })).toContain('checked=""')
    expect(checkbox({ checked: false })).not.toContain('checked=""')
  })

  it('type 은 checkbox 로 고정된다', () => {
    expect(checkbox()).toContain('type="checkbox"')
  })

  it('오류가 있으면 메시지를 오류 id 로 렌더하고 aria 를 배선한다', () => {
    const markup = checkbox({ error: '동의가 필요합니다.' })

    expect(markup).toContain(`id="${fieldErrorId('heatSensitive')}"`)
    expect(markup).toContain(`aria-describedby="${fieldErrorId('heatSensitive')}"`)
    expect(markup).toContain('aria-invalid="true"')
  })

  it('오류가 없으면 오류 요소와 aria 속성을 렌더하지 않는다', () => {
    const markup = checkbox()

    expect(markup).not.toContain(fieldErrorId('heatSensitive'))
    expect(markup).not.toContain('aria-invalid')
  })

  it('disabled 를 input 에 전달한다', () => {
    expect(checkbox({ disabled: true })).toContain('disabled=""')
  })
})
