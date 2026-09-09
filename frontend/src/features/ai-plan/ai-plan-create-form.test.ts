import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  AiPlanCreateForm,
  type AiPlanCreateFormProps,
} from '@/features/ai-plan/ai-plan-create-form'
import { SIGUNGU_LABEL } from '@/features/place/filter-labels'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { EMPTY_AI_PLAN_FORM_VALUES } from '@/types/ai-plan'
import type { Pet } from '@/types/pet'

/*
  `SIGUNGU_LABEL` 의 키는 시군구 코드 `'3'`(서귀포시) · `'4'`(제주시) 다 — 지역코드가
  아니다. `noUncheckedIndexedAccess` 때문에 인덱스 접근이 `string | undefined` 라
  여기서 한 번만 좁혀 쓴다.
*/
const JEJU_SI = SIGUNGU_LABEL['4'] ?? ''
const SEOGWIPO_SI = SIGUNGU_LABEL['3'] ?? ''

/*
  「더 자세히 정할게요」 안의 컨트롤은 **펼쳐졌을 때만 마운트된다.** 열림은 마운트 시
  1회 판정이라(`hasAnyDetail`) 검사하려는 축과 **다른 축**의 값으로 열어야 한다 —
  지역 칩을 보려면 예산으로, 예산 칩을 보려면 지역으로 연다.
*/
const OPEN_BY_BUDGET = { budgetManwon: '30' } as const
const OPEN_BY_REGION = { sigunguCode: '4' } as const

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
    today: '2026-09-02',
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

describe('AiPlanCreateForm — 지역 좁히기 (#251)', () => {
  /*
    계약에 `sigunguCode` 가 없던 동안에는 이 칩들을 빼고 "제주 전체에서 찾아요." 한 줄로
    대신하고 있었다. [PR #246](https://github.com/8llow8llowMe/hondigagae/pull/246) 이
    필드를 열면서 아트보드 01 대로 돌아왔다.
  */
  it('아트보드 01 의 세 갈래를 낸다', () => {
    const html = render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_BUDGET } })

    expect(html).toContain(messages.aiPlan.fieldRegion)
    expect(html).toContain(messages.aiPlan.fieldRegionAll)
    expect(html).toContain('제주시')
    expect(html).toContain('서귀포시')
  })

  /** 장소 찾기와 같은 표를 쓴다 — 같은 코드에 두 이름이 생기면 화면마다 다른 말을 한다 */
  it('선택지 이름을 장소 찾기와 같은 표에서 가져온다', () => {
    const html = render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_BUDGET } })

    expect(html).toContain(JEJU_SI)
    expect(html).toContain(SEOGWIPO_SI)
  })

  it('기본은 제주 전체가 골라져 있다 — 좁히는 것은 사용자가 고르는 일이다', () => {
    const html = render({
      values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_BUDGET, sigunguCode: null },
    })

    // 배타 칩은 `aria-checked` 로 선택을 말한다
    expect(html).toContain('aria-checked="true"')
  })

  /** 좁히면 못 만들 수 있다는 것을 **고르기 전에** 말한다 — 서버가 전체로 넓혀 주지 않는다 */
  it('좁히기의 결과를 한 줄로 밝힌다', () => {
    expect(render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_BUDGET } })).toContain(
      messages.aiPlan.fieldRegionHint,
    )
  })
})

describe('AiPlanCreateForm — 반려견은 체크박스 여러 마리 (#128)', () => {
  it('반려견마다 이름과 설명을 낸다', () => {
    const html = render()

    expect(html).toContain('몽실이')
    expect(html).toContain('초코')
  })

  /*
    아트보드 01 은 "반려견은 라디오 — 한 마리" 였다. 담기 직전에 판정 기준을 명시적으로
    고르게 해서 그 이탈 근거인 "판정 기준이 모호해진다" 를 없앴다 (다견선택-세부명세 D1).
  */
  it('반려견을 체크박스로 고른다 — 라디오가 아니다', () => {
    const html = render()

    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain('type="radio"')
  })

  it('여러 마리가 동시에 선택된 상태로 렌더된다', () => {
    const html = render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, petIds: ['1', '2'] } })

    expect(html.split('checked=""').length - 1).toBeGreaterThanOrEqual(2)
  })

  it('선택 근거를 안내한다', () => {
    expect(render()).toContain(messages.aiPlan.fieldPetHint)
  })
})

describe('AiPlanCreateForm — 예산은 칩 + 직접 입력', () => {
  it('어림값 칩 세 개와 상관없음을 준다', () => {
    const html = render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_REGION } })

    expect(html).toContain('20만원')
    expect(html).toContain('30만원')
    expect(html).toContain('50만원')
    expect(html).toContain(messages.aiPlan.budgetAny)
  })

  it('빈 값이면 상관없음이 골라져 있다 — 0 이 아니라 생략이 "안 정했다" 다', () => {
    const html = render({
      values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_REGION, budgetManwon: '' },
    })
    // exclusive 칩은 role="radio" + aria-checked 다
    expect(html).toContain('aria-checked="true"')
  })

  it('만원 단위임을 라벨로 밝힌다', () => {
    expect(render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_REGION } })).toContain(
      messages.aiPlan.fieldBudgetUnit,
    )
  })

  it('예산 칸은 number 가 아니다 — 휠 스크롤로 값이 바뀌면 안 된다', () => {
    expect(render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_REGION } })).toContain(
      'inputMode="numeric"',
    )
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

  /*
    예산 칸은 접기 안에 있다. **오류를 낸 값을 함께 넘긴다** — 실제 화면에서도 오류는
    값에서 나오므로 접기가 펼쳐진 채로 열린다. (제출 시점에 펼치는 effect 는
    `renderToStaticMarkup` 이 effect 를 돌리지 않아 여기서 검사할 수 없다.)
  */
  it('필드 오류를 그 필드에 붙인다', () => {
    const html = render({
      values: { ...EMPTY_AI_PLAN_FORM_VALUES, budgetManwon: '3.5' },
      errors: { fields: { budgetManwon: messages.aiPlan.errorBudgetPositive }, form: null },
    })

    expect(html).toContain(messages.aiPlan.errorBudgetPositive)
    expect(html).toContain('aria-invalid="true"')
  })

  /*
    포커스 이동 effect 는 `[id="${firstErrorField}"], [name="${firstErrorField}"]` 로
    대상을 찾는다 (`docs/form-guide.md` §8). **effect 자체는 node 환경에서 돌지 않지만
    그 셀렉터가 무엇을 찾는지는 마크업으로 검사할 수 있다** — 오류 키와 `id`/`name` 이
    어긋나면 제출 실패 시 포커스가 조용히 아무 데도 안 간다. 체크박스 그룹만 `name` 으로
    잡힌다 (`PetCheckboxGroup` 은 `id` 를 각 체크박스의 `name` 으로 쓴다).
  */
  it('오류 키마다 포커스 셀렉터가 찾을 대상이 있다', () => {
    const html = render({ values: { ...EMPTY_AI_PLAN_FORM_VALUES, ...OPEN_BY_REGION } })

    expect(html).toContain('id="startDate"')
    expect(html).toContain('id="endDate"')
    expect(html).toContain('id="requestNote"')
    expect(html).toContain('id="budgetManwon"')
    expect(html).toContain('name="petIds"')
  })
})

/*
  **네이티브 날짜 입력으로 되돌아가는 것을 막는 회귀 감시** (#162). `DateField` 는
  브라우저마다 다른 조작과 "여행 기간처럼 두 날짜의 관계를 보여줄 자리가 없다" 는 문제
  때문에 도입했다 (`date-field.tsx`). 새 날짜 입력이 `<input type="date">` 로 들어오면
  그 판단이 조용히 깨진다 — 같은 감시가 `plan-create-form.test.ts` 에도 있다.
*/
describe('AiPlanCreateForm — 날짜 입력이 네이티브로 돌아가지 않는다', () => {
  it('type="date" 를 쓰지 않는다', () => {
    expect(render()).not.toContain('type="date"')
  })
})

describe('AiPlanCreateForm — 선택 항목을 접는다', () => {
  it('아무것도 안 정했으면 지역 칩을 접어 둔다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.detailsToggle)
    expect(html).not.toContain(JEJU_SI)
  })

  it('접힌 줄이 기본값을 읽어 준다', () => {
    expect(render()).toContain('제주 전체 · 예산 상관없음')
  })

  it('예산이 이미 있으면 펼친 채로 연다 — 조건 바꾸기로 돌아온 경우다', () => {
    const html = render({
      values: { ...EMPTY_AI_PLAN_FORM_VALUES, budgetManwon: '30' },
    })

    expect(html).toContain(JEJU_SI)
  })

  it('필수 항목은 접지 않는다', () => {
    const html = render()

    expect(html).toContain(messages.aiPlan.fieldStartDate)
    expect(html).toContain(messages.aiPlan.fieldPet)
  })

  it('자유 요청은 접기 밖에 남는다 — AI 품질에 가장 크게 기여하는 입력이다', () => {
    expect(render()).toContain(messages.aiPlan.fieldNote)
  })
})
