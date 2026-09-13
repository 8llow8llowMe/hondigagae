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

  /*
    **#538 실측 결함의 회귀 방지.** 폼의 첫 오류 필드 포커스는
    `querySelector('#' + field)?.focus()` 한 줄이라(`pet-form.tsx`), 이 둘 중 하나만 빠져도
    **크기·활동량·사회성이 첫 오류일 때 포커스도 스크롤도 조용히 실패한다.**

    두 단언을 한 테스트에 묶는 이유는 둘이 하나의 계약이기 때문이다 — `id` 만 있으면
    조회는 되는데 `<fieldset>` 이 포커스 대상이 아니라 `focus()` 가 무시되고, `tabIndex`
    만 있으면 조회가 `null` 을 돌려준다. 한쪽만 지키는 상태를 통과시키면 안 된다.
  */
  it('fieldset 이 id 와 tabIndex 를 함께 갖는다 — 첫 오류 필드 포커스가 닿는 조건 (#538)', () => {
    const markup = radio()

    expect(markup).toContain('<fieldset id="sizeType"')
    expect(markup).toContain('tabindex="-1"')
  })

  it('선택지 id 는 그룹 id 와 갈린다 — fieldset 의 id 와 부딪히면 조회가 엉뚱한 것을 잡는다', () => {
    const markup = radio()

    // `sizeType` 은 fieldset 이 하나만 갖고, 선택지는 전부 `sizeType-<code>` 다
    expect(markup.match(/id="sizeType"/g)).toHaveLength(1)
  })

  describe('columns={3} — 3지선다 선택 카드 (#538)', () => {
    it('선택지를 3칸 그리드로 세운다', () => {
      expect(radio({ columns: 3 })).toContain('grid-cols-3')
    })

    it('기본값은 세로 목록이다 — 3지선다가 아닌 그룹까지 바뀌지 않는다', () => {
      expect(radio()).not.toContain('grid-cols-3')
    })

    /* 3칸에서도 `description` 은 남는다 — 선택의 근거라 줄일 수 없는 값이다 */
    it('3칸에서도 description 을 그대로 노출한다', () => {
      const markup = radio({ columns: 3 })

      expect(markup).toContain('체중 10kg 미만')
      expect(markup).toContain('체중 25kg 이상')
    })

    /* 배선이 두 벌이 되면 한쪽만 고친 채로 남는다 — 입력은 한 번만 그린다 */
    it('3칸에서도 name · checked · 오류 배선이 세로 목록과 같다', () => {
      const markup = radio({ columns: 3, value: 'LARGE', error: '크기 구분은 필수입니다.' })

      expect(markup.match(/name="sizeType"/g)).toHaveLength(3)
      expect(markup.match(/checked=""/g)).toHaveLength(1)
      expect(markup).toContain('id="sizeType-LARGE"')
      expect(markup).toContain(`aria-describedby="${fieldErrorId('sizeType')}"`)
    })
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
