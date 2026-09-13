import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { fieldErrorId } from '@/components/field'
import { PetFormFields, type PetFormFieldsProps } from '@/features/pet/pet-form'
import { petFormSchema } from '@/features/pet/schemas'
import { NO_FORM_ERRORS, toFormErrors } from '@/lib/form/field-errors'
import { validate } from '@/lib/form/validate'
import { messages } from '@/lib/messages'
import { EMPTY_PET_FORM_VALUES, toPetFormValues } from '@/lib/pet/form'
import type { Pet } from '@/types/pet'

function render(overrides: Partial<PetFormFieldsProps> = {}) {
  return renderToStaticMarkup(
    createElement(PetFormFields, {
      values: EMPTY_PET_FORM_VALUES,
      errors: NO_FORM_ERRORS,
      errorStatus: null,
      submitting: false,
      submitLabel: messages.pet.register,
      onValueChange: () => undefined,
      onSubmit: () => undefined,
      onRetry: () => undefined,
      ...overrides,
    }),
  )
}

describe('PetFormFields — 구성', () => {
  it('필드 10개를 모두 렌더한다', () => {
    const markup = render()

    // 텍스트 3
    for (const id of ['name', 'breed', 'birthYm']) {
      expect(markup).toContain(`id="${id}"`)
    }
    // 라디오 3그룹 × 3선택지
    expect(markup.match(/name="sizeType"/g)).toHaveLength(3)
    expect(markup.match(/name="activityLevel"/g)).toHaveLength(3)
    expect(markup.match(/name="sociality"/g)).toHaveLength(3)
    // 체크박스 4
    expect(markup.match(/type="checkbox"/g)).toHaveLength(4)
  })

  it('라디오 선택지의 description 을 노출한다 — 선택의 근거다', () => {
    const markup = render()

    expect(markup).toContain('체중 10kg 미만')
    expect(markup).toContain('일반적인 산책과 관광 일정을 소화합니다.')
  })

  it('초기 선택이 SMALL / MEDIUM / MEDIUM 이다', () => {
    const markup = render()

    expect(markup).toContain('id="sizeType-SMALL"')
    expect(markup).toContain('id="activityLevel-MEDIUM"')
    expect(markup).toContain('id="sociality-MEDIUM"')
    // 그룹 3개에서 각각 하나만 checked
    expect(markup.match(/checked=""/g)).toHaveLength(3)
  })

  it('체크박스 초기 상태는 모두 해제다 — 서버 기본값과 같다', () => {
    const markup = render()
    const checkboxSection = markup.slice(markup.indexOf('민감도'))

    expect(checkboxSection).not.toContain('checked=""')
  })

  it('입력 방법을 말하는 hint 만 남긴다', () => {
    const markup = render()

    expect(markup).toContain(messages.pet.hints.birthYm)
    expect(markup).toContain(messages.pet.hints.weightKg)
  })

  it("'선택 입력' 이라고 적지 않는다 — 필수 표시(*)가 없는 것이 곧 선택이다", () => {
    expect(render()).not.toContain('선택 입력')
  })

  /*
    **#369.** 단위가 라벨(`체중 (kg)`)과 플레이스홀더(`3.5kg`)에만 있었다. 플레이스홀더는
    **값을 채우는 순간 사라져** 무슨 단위인지 다시 알 수 없었고, 라벨과 겹쳐 같은 말이 두
    번 서 있었다. 단위를 입력란 안 상시 자리로 옮겼다.
  */
  it('체중 단위가 입력란 안에 상시로 선다 — 라벨·플레이스홀더에 겹쳐 두지 않는다', () => {
    const markup = render()

    expect(markup).toContain('>체중</label>')
    expect(markup).not.toContain('체중 (kg)')
    expect(markup).toContain('placeholder="3.5"')
    expect(markup).not.toContain('placeholder="3.5kg"')
    expect(markup).toContain(`>${messages.pet.weightUnit}</span>`)
  })

  /* 단위는 값이 아니라 그 옆에 그려지는 라벨이다 — 보내는 것은 숫자뿐이다 */
  it('단위가 입력값에 들어가지 않는다', () => {
    const markup = render({ values: { ...EMPTY_PET_FORM_VALUES, weightKg: '3.5' } })

    expect(markup).toContain('value="3.5"')
    expect(markup).not.toContain('value="3.5kg"')
  })

  /* 라벨(`체중`)과 함께 `체중 kg` 로 읽히지 않게 한다. 단위는 hint 가 이미 말한다 */
  it('단위는 스크린리더에서 감춘다', () => {
    const markup = render()
    const unit = /<span aria-hidden="true"[^>]*>kg<\/span>/.test(markup)

    expect(unit).toBe(true)
  })
})

describe('PetFormFields — 오류 표시', () => {
  it('필드 오류를 해당 필드에 렌더하고 aria 를 배선한다', () => {
    const markup = render({
      errors: { fields: { name: messages.pet.nameRequired }, form: null },
    })

    expect(markup).toContain(`id="${fieldErrorId('name')}"`)
    expect(markup).toContain(messages.pet.nameRequired)
    expect(markup).toContain('aria-invalid="true"')
  })

  it('라디오 그룹 오류도 fieldset 에 배선된다', () => {
    const markup = render({
      errors: { fields: { sizeType: messages.pet.sizeTypeRequired }, form: null },
    })

    expect(markup).toContain(`id="${fieldErrorId('sizeType')}"`)
    expect(markup).toContain(messages.pet.sizeTypeRequired)
  })

  it('폼 전체 오류는 role="alert" 로 렌더한다', () => {
    const markup = render({ errors: { fields: {}, form: messages.pet.limitReached } })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.pet.limitReached)
  })

  it('5xx 에서 ErrorState 와 입력 필드가 동시에 존재한다 — 폼을 대체하지 않는다', () => {
    const markup = render({ errorStatus: 500 })

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
    // 회귀 방지: 입력 필드가 사라지면 값을 고칠 수단이 없어진다 (#24 리뷰 I1)
    expect(markup).toContain('id="name"')
    expect(markup).toContain('id="birthYm"')
    expect(markup.match(/type="checkbox"/g)).toHaveLength(4)
  })

  it('400 은 ErrorState 를 띄우지 않는다 — 필드 오류로 표시한다', () => {
    const markup = render({
      errorStatus: 400,
      errors: { fields: { name: messages.pet.nameRequired }, form: null },
    })

    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.pet.nameRequired)
  })

  it('제출 중이면 버튼이 disabled 다', () => {
    const markup = render({ submitting: true })

    expect(markup).toContain('disabled=""')
    expect(markup).toContain('aria-busy="true"')
  })

  it('submitLabel 을 그대로 쓴다 — 등록·수정이 폼을 공용한다', () => {
    expect(render({ submitLabel: messages.pet.save })).toContain(messages.pet.save)
  })
})

/*
  **#538.** 아홉 필드가 375 에서 네 화면이라, 틀린 필드가 접힘 아래면 빨간 글자가 화면에
  없어 무엇이 잘못됐는지 알 수 없었다.

  **토스트가 아니라 `FormAlert` 다.** `styling-guide.md` §3-2 — "오류를 토스트로 말하지
  않는다. 오류는 섹션 안에 남아야 다시 시도할 수 있다." 요약이 사라지면 스크롤해 내려간
  뒤 남은 개수를 다시 볼 길이 없다.
*/
describe('PetFormFields — 제출 실패 요약 (#538)', () => {
  function summary(count: number) {
    return messages.pet.submitInvalidSummary.replace('{count}', String(count))
  }

  it('필드 오류 개수를 role="alert" 로 요약한다', () => {
    const markup = render({
      errors: {
        fields: { name: messages.pet.nameRequired, birthYm: messages.pet.birthYmFormat },
        form: null,
      },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(summary(2))
  })

  it('오류가 없으면 요약을 렌더하지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('role="alert"')
    expect(markup).not.toContain('확인이 필요한 항목')
  })

  /* 서버 문장이 개수보다 구체적이다 — 같은 자리에 둘을 겹쳐 쌓지 않는다 */
  it('서버가 준 폼 전체 오류가 요약을 이긴다', () => {
    const markup = render({
      errors: {
        fields: { sizeType: messages.pet.weightSizeMismatch },
        form: messages.pet.limitReached,
      },
    })

    expect(markup).toContain(messages.pet.limitReached)
    expect(markup).not.toContain(summary(1))
  })

  /* 필드 문구와 포커스는 그대로 남는다 — 요약이 그것을 대체하지 않는다 */
  it('요약이 필드별 오류 문구를 대체하지 않는다', () => {
    const markup = render({ errors: { fields: { name: messages.pet.nameRequired }, form: null } })

    expect(markup).toContain(summary(1))
    expect(markup).toContain(messages.pet.nameRequired)
    expect(markup).toContain(`id="${fieldErrorId('name')}"`)
  })

  /*
    **"입력하지 않은" 이라고 쓰지 않는다.** 크기·활동량·사회성은 초기값이 이미 있어
    (`EMPTY_PET_FORM_VALUES`) 미입력으로 실패하지 않는다 — 실제로 걸리는 것은 생년월
    형식·체중 범위·체중↔크기 모순처럼 **채웠는데 어긋난** 값이다.
  */
  it('미입력이라고 단정하지 않는다 — 채웠는데 어긋난 값이 더 흔하다', () => {
    const markup = render({
      errors: { fields: { sizeType: messages.pet.weightSizeMismatch }, form: null },
    })

    expect(markup).not.toContain('입력하지 않은')
    expect(markup).toContain(summary(1))
  })
})

describe('PetFormFields — 3칸 선택 카드와 하단 바 (#538)', () => {
  /* 셋 다 3지선다다. 한 줄에 서야 필수 넷이 한 화면 안으로 들어온다 */
  it('크기 · 활동량 · 사회성이 3칸 그리드다', () => {
    expect(render().match(/grid-cols-3/g)).toHaveLength(3)
  })

  /*
    **`sticky` 라 자리를 스스로 차지한다** — 본문 끝에 바 높이만큼 여백을 따로 두지 않아도
    마지막 줄이 가려지지 않는다 (`fixed` 였다면 필요했다).

    **오프셋이 폭마다 갈린다** — 비켜야 할 모바일 탭바가 `md:hidden` 이라 768 부터 사라진다.
    `bottom-16` 만 두면 그 폭에서 바가 바닥에서 64px 떠 아래로 본문이 비친다.
  */
  it('제출 버튼이 탭바를 비켜 선 sticky 바 안에 있다', () => {
    const markup = render()
    const bar = markup.slice(markup.lastIndexOf('<div class='))

    expect(bar).toContain('sticky')
    expect(bar).toContain('bottom-16')
    expect(bar).toContain('md:bottom-0')
    expect(bar).toContain('type="submit"')
    expect(bar).toContain(messages.pet.register)
  })
})

describe('PetFormFields — 수정 초기값', () => {
  const pet: Pet = {
    petId: '123456789012000001',
    name: '몽실이',
    breed: '말티즈',
    birthYm: '2017-05',
    age: 9,
    sizeType: { code: 'LARGE', name: '대형견', description: '체중 25kg 이상' },
    weightKg: null,
    profileImageUrl: null,
    representative: false,
    heatSensitive: true,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: {
      code: 'HIGH',
      name: '높음',
      description: '긴 산책과 활동적인 일정을 선호합니다.',
    },
    walkPreferred: true,
    sociality: { code: 'LOW', name: '낮음', description: '다른 개나 낯선 사람을 불편해합니다.' },
  }

  it('기존 값으로 폼을 채운다', () => {
    const markup = render({ values: toPetFormValues(pet) })

    expect(markup).toContain('value="몽실이"')
    expect(markup).toContain('value="말티즈"')
    expect(markup).toContain('value="2017-05"')
  })

  it('응답 metadata 의 code 에 해당하는 라디오가 선택된다', () => {
    const markup = render({ values: toPetFormValues(pet) })

    expect(markup).toMatch(/id="sizeType-LARGE"[^>]*checked=""|checked=""[^>]*id="sizeType-LARGE"/)
    expect(markup).toContain('id="activityLevel-HIGH"')
    expect(markup).toContain('id="sociality-LOW"')
  })

  it('null 인 breed / birthYm 은 빈 문자열로 들어간다 — null 을 value 로 주지 않는다', () => {
    const markup = render({ values: toPetFormValues({ ...pet, breed: null, birthYm: null }) })

    expect(markup).toContain('id="breed"')
    expect(markup).not.toContain('value="null"')
  })

  it('true 인 boolean 이 checked 로 반영된다', () => {
    const markup = render({ values: toPetFormValues(pet) })
    const checkboxes = markup.match(
      /type="checkbox"[^>]*checked=""|checked=""[^>]*type="checkbox"/g,
    )

    // heatSensitive + walkPreferred = 2개
    expect(checkboxes).toHaveLength(2)
  })
})

/*
  **PET_004 는 도메인 예외라 형태가 다르다** (#369 · BE #364).

  Bean Validation(`PET_100`)은 `{ message, errors: [{code, field, message}] }` 이지만
  이쪽은 `resultMessage` 가 **문자열**이라 붙일 필드가 없다 — `toFormErrors` 가 폼 전체
  오류로 돌리고 화면은 `FormAlert` 로 띄운다. 서버 문장이 경계를 그대로 설명한다.

  **여기까지 오는 것은 백스톱이다.** 폼이 체중에 맞춰 크기를 옮기고(`sizeChangeForWeight`)
  스키마가 어긋난 조합을 막으므로(`petFormSchema`), 사용자가 이 400 을 만날 길은
  두 방어를 모두 지난 경우뿐이다.
*/
describe('PetFormFields — PET_004 서버 오류 (#369)', () => {
  const SERVER_MESSAGE =
    '체중과 크기 구분이 맞지 않습니다. 소형견 10kg 미만 · 중형견 10~25kg 미만 · 대형견 25kg 이상 기준으로 선택해 주세요.'

  it('문자열 resultMessage 를 폼 전체 오류로 돌린다', () => {
    const errors = toFormErrors(SERVER_MESSAGE, messages.form.submitFailed)

    expect(errors.form).toBe(SERVER_MESSAGE)
    expect(errors.fields).toEqual({})
  })

  it('폼 상단 경고로 띄운다 — 서버 문장을 고쳐 쓰지 않는다', () => {
    const markup = render({ errors: { fields: {}, form: SERVER_MESSAGE } })

    expect(markup).toContain(SERVER_MESSAGE)
  })

  /* 400 은 일시 장애가 아니다 — ErrorState 로 폼을 덮으면 고칠 수단이 사라진다 */
  it('폼을 ErrorState 로 덮지 않는다 — 값을 고칠 수단이 남아야 한다', () => {
    const markup = render({ errors: { fields: {}, form: SERVER_MESSAGE }, errorStatus: 400 })

    expect(markup).toContain('id="weightKg"')
    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
  })
})

describe('petFormSchema', () => {
  function check(overrides: Record<string, unknown>) {
    return validate(petFormSchema, { ...EMPTY_PET_FORM_VALUES, name: '몽실이', ...overrides })
  }

  it('빈 birthYm 은 통과한다 — 선택 입력이다', () => {
    expect(check({ birthYm: '' }).ok).toBe(true)
  })

  it('13월은 거부한다', () => {
    const result = check({ birthYm: '2020-13' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.birthYm).toBe(messages.pet.birthYmFormat)
  })

  it('한 자리 월은 거부한다 — 백엔드 정규식과 같다', () => {
    expect(check({ birthYm: '2020-3' }).ok).toBe(false)
  })

  it('공백만 있는 이름은 거부한다', () => {
    const result = check({ name: '   ' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.name).toBe(messages.pet.nameRequired)
  })

  it('21자 이름은 거부한다', () => {
    const result = check({ name: 'ㄱ'.repeat(21) })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.name).toBe(messages.pet.nameLength)
  })

  it('빈 품종은 통과한다', () => {
    expect(check({ breed: '' }).ok).toBe(true)
  })

  it('51자 품종은 거부한다', () => {
    const result = check({ breed: 'ㄱ'.repeat(51) })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.breed).toBe(messages.pet.breedLength)
  })

  /*
    **PET_004 의 FE 복제본** (#369 · BE #364). 백엔드가 모순 조합을 400 으로 거부하므로,
    같은 경계를 스키마가 들고 제출 전에 막는다. 체중을 고치면 크기가 저절로 따라오니
    이 오류는 **크기를 직접 어긋나게 골랐을 때만** 남고, 그래서 `sizeType` 에 붙는다.
  */
  it('30kg 소형견을 거부하고 오류를 크기에 붙인다 (PET_004)', () => {
    const result = check({ weightKg: '30', sizeType: 'SMALL' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.fields.sizeType).toBe(messages.pet.weightSizeMismatch)
      // 체중 자체는 유효한 값이다 — 어긋난 것은 둘의 조합이다
      expect(result.errors.fields.weightKg).toBeUndefined()
    }
  })

  it.each([
    ['9.9', 'SMALL'],
    ['10.0', 'MEDIUM'],
    ['24.9', 'MEDIUM'],
    ['25.0', 'LARGE'],
  ])('경계 %s kg 에 맞는 크기(%s)는 통과한다', (weightKg, sizeType) => {
    expect(check({ weightKg, sizeType }).ok).toBe(true)
  })

  it.each([
    ['9.9', 'MEDIUM'],
    ['10.0', 'SMALL'],
    ['24.9', 'LARGE'],
    ['25.0', 'MEDIUM'],
  ])('경계 %s kg 에 어긋난 크기(%s)는 거부한다', (weightKg, sizeType) => {
    expect(check({ weightKg, sizeType }).ok).toBe(false)
  })

  /* 체중이 비면 어긋남을 판정할 수 없다 — 크기만으로 저장할 수 있어야 한다 */
  it('체중이 비었으면 어느 크기든 통과한다', () => {
    for (const sizeType of ['SMALL', 'MEDIUM', 'LARGE'] as const) {
      expect(check({ weightKg: '', sizeType }).ok).toBe(true)
    }
  })
})
