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
    weightKg: null,
    profileImageUrl: null,
    representative: false,
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
    today: '2026-09-02',
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

  /*
    **`<input type="date">` 의 `min` 을 확인하던 자리다.** 날짜 입력이 `DateField` 로
    바뀌면서 그 제약은 마크업 속성이 아니라 **달력에서 그 칸을 잠그는 것**으로 옮겨갔고,
    달력은 열려야 렌더되므로 정적 렌더 테스트에서는 보이지 않는다.
    잠금 자체는 `components/calendar.test.ts` 의 "min 보다 이른 칸을 잠근다" 가 지킨다.
    여기서는 **네이티브 날짜 입력으로 되돌아가지 않았는지**를 지킨다.
  */
  it('날짜는 네이티브 date 입력이 아니다 — 달력을 우리가 그린다', () => {
    const html = render({ values: values() })

    expect(html).not.toContain('type="date"')
    expect(html).toContain('id="startDate"')
    expect(html).toContain('id="endDate"')
    expect(html).toContain('aria-haspopup="dialog"')
    // 타이핑을 막는다 — 손으로 치면 `2026/9/1` 이 들어오고 전부 형식 오류가 된다
    expect(html.match(/readOnly=""/g)).toHaveLength(2)
  })

  it('고른 날짜를 요일까지 보여준다 — 여행 계획에서 요일은 날짜만큼 중요하다', () => {
    const html = render({ values: values() })

    expect(html).toContain('2026년 9월 12일 (토)')
    expect(html).toContain('2026년 9월 14일 (월)')
  })

  it('예산은 number 가 아니다 — 휠 스크롤로 값이 바뀌면 안 된다', () => {
    const html = render()
    expect(html).toContain('inputMode="numeric"')
    expect(html).not.toContain('type="number"')
  })

  it('라디오 그룹이 그룹 이름을 id 와 name 둘 다로 노출한다 — 포커스 이동이 닿는 조건', () => {
    /*
      **#538 에서 `RadioGroup` 이 `<fieldset>` 에 `id` 와 `tabIndex={-1}` 을 갖게 됐다.**
      예전에는 `${id}-${value}` 가 개별 라디오에만 붙어 `#petId` 에 해당하는 요소가 없었고,
      그래서 포커스 effect 가 `[name]` 을 함께 보는 우회로 열려 있었다.

      우회는 그대로 둔다 — 선택자가 `[id], [name]` 둘 다라 이제 문서 순서상 앞인
      `<fieldset>` 을 잡는다. **그쪽이 더 낫다**: `aria-describedby` 가 fieldset 에 걸려
      있어(`radio-group.tsx`) 포커스가 오는 순간 오류 문구가 함께 읽힌다. 개별 라디오에는
      그 배선이 없다.
    */
    const html = render()
    expect(html).toContain('name="petId"')
    expect(html).toContain('<fieldset id="petId"')
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

  /*
    상한이 없던 시절에는 큰 수가 그대로 나가 서버가 역직렬화에서 깨졌고, 그 응답이
    필드를 못 짚어 **"요청 본문을 읽을 수 없습니다. JSON 형식을 확인해 주세요."** 가
    폼 상단 배너로 떴다 (#566). 경계는 dev 실측값이다.
  */
  it('Integer 상한을 넘는 예산은 막고, 오류를 예산 칸에 붙인다', () => {
    expect(validate(planFormSchema, values({ budget: '2147483647' })).ok).toBe(true)

    const result = validate(planFormSchema, values({ budget: '2147483648' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.fields.budget).toBe(messages.plan.errorBudgetTooLarge)
  })

  it('서식이 틀린 예산에는 "너무 커요" 가 아니라 서식 오류를 말한다', () => {
    const result = validate(planFormSchema, values({ budget: 'abc' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.fields.budget).toBe(messages.plan.errorBudgetNegative)
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
