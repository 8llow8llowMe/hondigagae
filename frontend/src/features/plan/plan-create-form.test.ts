import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanCreateForm, type PlanCreateFormProps } from '@/features/plan/plan-create-form'
import { planFormSchema } from '@/features/plan/schemas'
import { validate } from '@/lib/form/validate'
import { messages } from '@/lib/messages'
import { toPlanCreatePayload } from '@/lib/plan/form'
import type { Pet } from '@/types/pet'
import { EMPTY_PLAN_FORM_VALUES, type PlanFormValues } from '@/types/plan'

function pet(overrides: Partial<Pet> = {}): Pet {
  return {
    petId: '123456789012000001',
    name: '몽실이',
    breed: '말티즈',
    birthYm: '2017-05',
    age: 9,
    sizeType: { code: 'SMALL', name: '소형견', description: null },
    heatSensitive: true,
    coldSensitive: false,
    noiseSensitive: true,
    activityLevel: { code: 'MEDIUM', name: '보통', description: null },
    walkPreferred: true,
    sociality: { code: 'HIGH', name: '높음', description: null },
    ...overrides,
  }
}

function render(overrides: Partial<PlanCreateFormProps> = {}) {
  const props: PlanCreateFormProps = {
    values: EMPTY_PLAN_FORM_VALUES,
    errors: { fields: {}, form: null },
    pets: [pet()],
    submitting: false,
    submitCount: 0,
    firstErrorField: null,
    onValueChange: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  }
  return renderToStaticMarkup(createElement(PlanCreateForm, props))
}

function values(overrides: Partial<PlanFormValues> = {}): PlanFormValues {
  return {
    petId: '123456789012000001',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    budget: '',
    ...overrides,
  }
}

describe('만들기 폼 — 화면', () => {
  it('지역 입력을 두지 않는다 — 제주 전용이라 선택지가 하나뿐이다', () => {
    const html = render()
    expect(html).not.toContain('areaCode')
    expect(html).not.toContain('지역')
  })

  it('반려견을 라디오로 고른다 — 하나만 고르는 축이다', () => {
    expect(render()).toContain('radio')
  })

  it('종료일 입력이 시작일보다 이른 날짜를 브라우저에서 먼저 막는다', () => {
    expect(render({ values: values() })).toContain('min="2026-09-12"')
  })

  it('예산은 number 가 아니다 — 휠 스크롤로 값이 바뀌면 안 된다', () => {
    const html = render()
    expect(html).toContain('inputMode="numeric"')
    expect(html).not.toContain('type="number"')
  })

  it('라디오 그룹의 오류는 name 으로 찾는다 — fieldset 에는 id 가 없다', () => {
    // RadioGroup 은 `${id}-${value}` 를 개별 라디오에 붙이므로 `#petId` 는 없다.
    // 포커스 이동 effect 가 `[name="petId"]` 를 함께 보는 근거다
    const html = render()
    expect(html).toContain('name="petId"')
    expect(html).not.toContain('id="petId"')
  })

  it('폼 전체 오류는 role="alert" 로 알린다', () => {
    const html = render({ errors: { fields: {}, form: '저장하지 못했어요.' } })
    expect(html).toContain('role="alert"')
  })
})

describe('만들기 폼 — 검증', () => {
  it('시작일이 종료일보다 늦으면 종료일에 오류를 붙인다 (PLAN_003 선반영)', () => {
    const result = validate(
      planFormSchema,
      values({ startDate: '2026-09-14', endDate: '2026-09-12' }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.fields.endDate).toBe(messages.plan.errorDateRange)
  })

  it('같은 날 출발·도착은 통과한다 — 하루짜리 일정이다', () => {
    expect(validate(planFormSchema, values({ endDate: '2026-09-12' })).ok).toBe(true)
  })

  it('예산은 빈 값을 허용한다 — 막으면 선택 입력이 사실상 필수가 된다', () => {
    expect(validate(planFormSchema, values({ budget: '' })).ok).toBe(true)
  })

  it('음수·소수 예산은 막는다', () => {
    expect(validate(planFormSchema, values({ budget: '-1' })).ok).toBe(false)
    expect(validate(planFormSchema, values({ budget: '1.5' })).ok).toBe(false)
  })

  it('60자를 넘는 제목은 막는다 — 서버 제한과 같은 값이다', () => {
    expect(validate(planFormSchema, values({ title: 'ㄱ'.repeat(61) })).ok).toBe(false)
    expect(validate(planFormSchema, values({ title: 'ㄱ'.repeat(60) })).ok).toBe(true)
  })
})

describe('만들기 폼 — 요청 본문 변환', () => {
  it('petId 를 숫자로 바꾸지 않는다 — Snowflake 라 정밀도를 잃는다', () => {
    expect(toPlanCreatePayload(values()).petId).toBe('123456789012000001')
  })

  it('areaCode 는 제주(39) 고정이다', () => {
    expect(toPlanCreatePayload(values()).areaCode).toBe('39')
  })

  it('빈 예산은 null 이 아니라 키 자체를 뺀다 — 생략이 "안 정했다" 다', () => {
    expect('budget' in toPlanCreatePayload(values({ budget: '' }))).toBe(false)
  })

  it('예산을 적으면 숫자로 보낸다', () => {
    expect(toPlanCreatePayload(values({ budget: ' 400000 ' })).budget).toBe(400000)
  })

  it('제목 앞뒤 공백을 떼고 보낸다', () => {
    expect(toPlanCreatePayload(values({ title: '  제주  ' })).title).toBe('제주')
  })

  it('items 를 보내지 않는다 — 빈 일정을 만들고 장소는 나중에 담는다', () => {
    expect('items' in toPlanCreatePayload(values())).toBe(false)
  })
})
