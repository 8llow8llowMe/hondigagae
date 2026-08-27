import { describe, expect, it } from 'vitest'

import {
  EMPTY_PET_FORM_VALUES,
  isPetSizeCode,
  toPetFormValues,
  toPetSavePayload,
} from '@/lib/pet/form'
import type { Pet } from '@/types/pet'

const pet: Pet = {
  petId: '1234567890123456789',
  name: '몽실이',
  breed: '말티즈',
  birthYm: '2017-05',
  age: 9,
  sizeType: { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: false,
  activityLevel: {
    code: 'MEDIUM',
    name: '보통',
    description: '일반적인 산책과 관광 일정을 소화합니다.',
  },
  walkPreferred: true,
  sociality: { code: 'HIGH', name: '높음', description: '다른 개나 사람과 잘 어울립니다.' },
}

describe('toPetSavePayload', () => {
  it('빈 birthYm 을 null 로 보낸다 — 빈 문자열은 서버가 PET_104 로 거부한다', () => {
    const payload = toPetSavePayload({ ...EMPTY_PET_FORM_VALUES, name: '몽실이', birthYm: '' })

    expect(payload.birthYm).toBeNull()
  })

  it('공백만 있는 birthYm 도 null 로 보낸다', () => {
    const payload = toPetSavePayload({ ...EMPTY_PET_FORM_VALUES, name: '몽실이', birthYm: '   ' })

    expect(payload.birthYm).toBeNull()
  })

  it('빈 breed 를 null 로 보낸다 — 서버는 받아주지만 빈 배지를 그리게 된다', () => {
    const payload = toPetSavePayload({ ...EMPTY_PET_FORM_VALUES, name: '몽실이', breed: '' })

    expect(payload.breed).toBeNull()
  })

  it('값이 있으면 trim 해서 보낸다', () => {
    const payload = toPetSavePayload({
      ...EMPTY_PET_FORM_VALUES,
      name: '  몽실이  ',
      breed: '  말티즈  ',
      birthYm: ' 2017-05 ',
    })

    expect(payload.name).toBe('몽실이')
    expect(payload.breed).toBe('말티즈')
    expect(payload.birthYm).toBe('2017-05')
  })

  it('boolean 4개를 항상 명시적으로 담는다 — 누락하면 서버가 조용히 false 로 채운다', () => {
    const payload = toPetSavePayload({ ...EMPTY_PET_FORM_VALUES, name: '몽실이' })

    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining(['heatSensitive', 'coldSensitive', 'noiseSensitive', 'walkPreferred']),
    )
    expect(payload.heatSensitive).toBe(false)
    expect(payload.walkPreferred).toBe(false)
  })

  it('enum 을 code 문자열로 보낸다 — 응답의 metadata 객체가 아니다', () => {
    const payload = toPetSavePayload({
      ...EMPTY_PET_FORM_VALUES,
      name: '몽실이',
      sizeType: 'LARGE',
      activityLevel: 'HIGH',
      sociality: 'LOW',
    })

    expect(payload.sizeType).toBe('LARGE')
    expect(payload.activityLevel).toBe('HIGH')
    expect(payload.sociality).toBe('LOW')
  })

  it('10개 필드를 모두 담는다 — PUT 은 부분 수정이 아니다', () => {
    const payload = toPetSavePayload({ ...EMPTY_PET_FORM_VALUES, name: '몽실이' })

    expect(Object.keys(payload).sort()).toEqual(
      [
        'activityLevel',
        'birthYm',
        'breed',
        'coldSensitive',
        'heatSensitive',
        'name',
        'noiseSensitive',
        'sizeType',
        'sociality',
        'walkPreferred',
      ].sort(),
    )
  })
})

describe('toPetFormValues', () => {
  it('응답의 metadata 객체에서 code 를 꺼낸다 — 놓치면 수정 저장이 조용히 깨진다', () => {
    const values = toPetFormValues(pet)

    expect(values.sizeType).toBe('SMALL')
    expect(values.activityLevel).toBe('MEDIUM')
    expect(values.sociality).toBe('HIGH')
  })

  it('null 인 breed / birthYm 을 빈 문자열로 바꾼다 — controlled input 은 null 을 못 받는다', () => {
    const values = toPetFormValues({ ...pet, breed: null, birthYm: null })

    expect(values.breed).toBe('')
    expect(values.birthYm).toBe('')
  })

  it('boolean 을 그대로 옮긴다', () => {
    const values = toPetFormValues(pet)

    expect(values.heatSensitive).toBe(true)
    expect(values.coldSensitive).toBe(false)
    expect(values.walkPreferred).toBe(true)
  })

  it('왕복해도 값이 보존된다 (응답 → 폼 → 요청)', () => {
    const payload = toPetSavePayload(toPetFormValues(pet))

    expect(payload).toEqual({
      name: '몽실이',
      breed: '말티즈',
      birthYm: '2017-05',
      sizeType: 'SMALL',
      heatSensitive: true,
      coldSensitive: false,
      noiseSensitive: false,
      activityLevel: 'MEDIUM',
      walkPreferred: true,
      sociality: 'HIGH',
    })
  })

  it('서버가 모르는 enum code 를 내려주면 기본값으로 떨어진다', () => {
    const values = toPetFormValues({
      ...pet,
      sizeType: { code: 'GIANT', name: '초대형견', description: null },
    })

    // enum 에 값이 추가되면 FE 가 조용히 낡는다 (공통명세 S6-1).
    // 폼이 깨지는 것보다 기본값으로 떨어지는 것이 낫다.
    expect(values.sizeType).toBe('SMALL')
  })
})

describe('isPetSizeCode', () => {
  it('알려진 code 만 통과시킨다', () => {
    expect(isPetSizeCode('SMALL')).toBe(true)
    expect(isPetSizeCode('GIANT')).toBe(false)
    expect(isPetSizeCode('')).toBe(false)
  })
})
