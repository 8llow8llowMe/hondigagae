import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  AiPlanCreateForm,
  type AiPlanCreateFormProps,
} from '@/features/ai-plan/ai-plan-create-form'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { EMPTY_AI_PLAN_FORM_VALUES } from '@/types/ai-plan'
import type { Pet } from '@/types/pet'

function pet(petId: string, name: string): Pet {
  return {
    petId,
    name,
    breed: '말티즈',
    birthYm: '2022-04',
    age: 4,
    sizeType: { code: 'SMALL', name: '소형견' },
    weightKg: null,
    profileImageUrl: null,
    representative: false,
    heatSensitive: true,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: { code: 'MEDIUM', name: '보통' },
    walkPreferred: true,
    sociality: { code: 'HIGH', name: '높음' },
  }
}

function render(overrides: Partial<AiPlanCreateFormProps> = {}) {
  const props: AiPlanCreateFormProps = {
    values: EMPTY_AI_PLAN_FORM_VALUES,
    errors: NO_FORM_ERRORS,
    pets: [pet('1', '몽실이'), pet('2', '초코')],
    totalDays: null,
    submitting: false,
    submitCount: 0,
    firstErrorField: null,
    favoriteCount: 0,
    onOpenPlacePicker: () => undefined,
    onValueChange: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanCreateForm, props))
}

describe('AiPlanCreateForm — 자유 입력은 선택이다 (아트보드 01)', () => {
  it('자유 입력 칸을 낸다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.fieldNote)
    expect(html).toContain('<textarea')
  })

  it('예시 문구를 함께 둔다 — "뭘 써야 하지" 에서 막히지 않게', () => {
    expect(render()).toContain(messages.aiPlan.fieldNoteHint)
  })

  it('500자로 상한을 건다 (AIPLAN_107)', () => {
    expect(render()).toContain('maxLength="500"')
  })
})

describe('AiPlanCreateForm — 지역 컨트롤이 없다 (명세 S2)', () => {
  it('지역 선택 컨트롤을 만들지 않는다 — 계약에 sigunguCode 가 없다', () => {
    const html = render()

    // 아트보드 01 의 지역 칩 세 개(제주시 / 서귀포시 / 제주 전체)를 뺐다.
    // 그룹 라벨이 없다는 것으로 확인한다 — "제주 전체" 는 아래 고정 안내 문구에도
    // 들어 있어 낱말만으로는 가릴 수 없다
    expect(html).not.toContain('지역')
    expect(html).not.toContain('서귀포시')
  })

  it('대신 제주 전체에서 찾는다고 한 줄로 밝힌다 — 누락으로 보이지 않게', () => {
    expect(render()).toContain(messages.aiPlan.areaFixed)
  })
})

describe('AiPlanCreateForm — 반려견은 라디오 한 마리', () => {
  it('반려견마다 이름과 설명을 낸다', () => {
    const html = render()

    expect(html).toContain('몽실이')
    expect(html).toContain('초코')
  })

  it('여러 마리를 함께 고르는 컨트롤을 두지 않는다', () => {
    const html = render()

    // 반려견은 라디오다 — 아트보드 01 "반려견은 라디오 — 한 마리"
    expect(html).toContain('type="radio"')

    /*
      **`type="checkbox"` 부재로 검사하지 않는다.** #128 이 `저장한 곳 먼저` 체크박스를
      더해서 그 검사는 이제 그 옵션에 걸린다. 확인하려는 것은 **반려견 다중 선택의 부재**라,
      폼 안의 유일한 체크박스가 그 옵션임을 본다.

      다중 반려견(`petIds`)은 아트보드 05 에 설계돼 있으나 `plan-service` 의 `Plan` 이
      `petId` 단일이라 미뤘다 (명세 S8).
    */
    expect(html.match(/type="checkbox"/g) ?? []).toHaveLength(1)
    expect(html).toContain('id="preferFavorites"')
  })

  it('선택 근거를 안내한다', () => {
    expect(render()).toContain(messages.aiPlan.fieldPetHint)
  })
})

describe('AiPlanCreateForm — 예산은 칩 + 직접 입력', () => {
  it('어림값 칩 세 개와 상관없음을 준다', () => {
    const html = render()

    expect(html).toContain('20만원')
    expect(html).toContain('30만원')
    expect(html).toContain('50만원')
    expect(html).toContain(messages.aiPlan.budgetAny)
  })

  it('빈 값이면 상관없음이 골라져 있다 — 0 이 아니라 생략이 "안 정했다" 다', () => {
    const html = render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, budgetManwon: '' } })
    // exclusive 칩은 role="radio" + aria-checked 다
    expect(html).toContain('aria-checked="true"')
  })

  it('만원 단위임을 라벨로 밝힌다', () => {
    expect(render()).toContain(messages.aiPlan.fieldBudgetUnit)
  })

  it('예산 칸은 number 가 아니다 — 휠 스크롤로 값이 바뀌면 안 된다', () => {
    expect(render()).toContain('inputMode="numeric"')
  })
})

describe('AiPlanCreateForm — 기대를 미리 맞춘다', () => {
  it('소요 시간과 저장 시점을 버튼 아래에 말한다', () => {
    expect(render()).toContain(messages.aiPlan.createSubmitHint)
  })

  it('기간을 다 고르면 일수를 말한다', () => {
    expect(render({ totalDays: 3 })).toContain('3일 일정이에요.')
  })

  it('기간이 덜 채워졌으면 일수를 말하지 않는다', () => {
    expect(render({ totalDays: null })).not.toContain('일정이에요.')
  })

  it('제출 중에는 버튼을 잠근다', () => {
    expect(render({ submitting: true })).toContain('aria-busy="true"')
  })
})

describe('AiPlanCreateForm — 오류 표시', () => {
  it('폼 전체 오류를 role="alert" 로 낸다', () => {
    const html = render({ errors: { fields: {}, form: '요청 값이 올바르지 않습니다.' } })

    expect(html).toContain('role="alert"')
    expect(html).toContain('요청 값이 올바르지 않습니다.')
  })

  it('필드 오류를 그 필드에 붙인다', () => {
    const html = render({
      errors: { fields: { budgetManwon: messages.aiPlan.errorBudgetPositive }, form: null },
    })

    expect(html).toContain(messages.aiPlan.errorBudgetPositive)
    expect(html).toContain('aria-invalid="true"')
  })
})
