import { describe, expect, it } from 'vitest'

import {
  changedPet,
  petSizeFiltersAfterHistory,
  petSizeFiltersAfterPetChange,
} from '@/lib/place/pet-size-filter'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { Pet } from '@/types/pet'
import type { PlaceFilters } from '@/types/place'

function pet(sizeCode: string, sizeName: string, weightKg: number | null): Pet {
  return {
    petId: `pet-${sizeCode}`,
    name: '초코',
    breed: '래브라도 리트리버',
    birthYm: '2021-03',
    age: 5,
    sizeType: { code: sizeCode, name: sizeName },
    weightKg,
    profileImageUrl: null,
    representative: false,
    heatSensitive: false,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: { code: 'HIGH', name: '높음' },
    walkPreferred: true,
    sociality: { code: 'HIGH', name: '높음' },
  }
}

const SMALL_ON: PlaceFilters = { ...DEFAULT_PLACE_FILTERS, petSizeType: 'SMALL', petWeightKg: 4 }

/**
 * 반려견이 바뀐 뒤 체구 필터 — 장소-반려견칩-세부명세 D1-2 ② · D7-4.
 *
 * `null` 은 "URL 을 고칠 일이 없다" 다. 호출부가 `null` 이면 `replace` 를 내지 않는다.
 */
describe('petSizeFiltersAfterPetChange', () => {
  it('체구 필터가 꺼져 있으면 할 일이 없다', () => {
    expect(petSizeFiltersAfterPetChange(DEFAULT_PLACE_FILTERS, pet('LARGE', '대형견', 30))).toBe(
      null,
    )
  })

  it('켜져 있으면 새 반려견의 크기로 바꾸고, 체중을 모르면 체중을 비운다', () => {
    expect(petSizeFiltersAfterPetChange(SMALL_ON, pet('LARGE', '대형견', null))).toEqual({
      ...SMALL_ON,
      petSizeType: 'LARGE',
      petWeightKg: null,
    })
  })

  it('체중은 올림해서 보낸다 — 3.5kg 는 4', () => {
    const large: PlaceFilters = {
      ...DEFAULT_PLACE_FILTERS,
      petSizeType: 'LARGE',
      petWeightKg: null,
    }

    expect(petSizeFiltersAfterPetChange(large, pet('SMALL', '소형견', 3.5))).toEqual({
      ...large,
      petSizeType: 'SMALL',
      petWeightKg: 4,
    })
  })

  it('모르는 크기 코드면 두 값을 모두 비운다 — 필터가 꺼진다', () => {
    expect(petSizeFiltersAfterPetChange(SMALL_ON, pet('GIANT', '초대형견', 50))).toEqual({
      ...SMALL_ON,
      petSizeType: null,
      petWeightKg: null,
    })
  })

  it('이미 같은 값이면 할 일이 없다', () => {
    expect(petSizeFiltersAfterPetChange(SMALL_ON, pet('SMALL', '소형견', 3.2))).toBe(null)
  })

  it('다른 축(지역 · 유형 · 동반 · 검색어)은 그대로 둔다', () => {
    const filters: PlaceFilters = {
      ...SMALL_ON,
      sigunguCode: '3',
      contentType: 'RESTAURANT',
      petAllowanceType: 'ALLOWED',
      indoor: true,
      keyword: '해변',
    }

    expect(petSizeFiltersAfterPetChange(filters, pet('MEDIUM', '중형견', 12))).toEqual({
      ...filters,
      petSizeType: 'MEDIUM',
      petWeightKg: 12,
    })
  })
})

describe('changedPet — A → B 일 때만 바뀜이다', () => {
  const choco = pet('LARGE', '대형견', null)

  it('직전이 없으면(첫 확정) 바뀜이 아니다 — 첫 로드에 URL 을 고치지 않는다', () => {
    expect(changedPet(null, choco)).toBe(null)
  })

  it('다음이 없으면 맞출 대상이 없다', () => {
    expect(changedPet('pet-SMALL', null)).toBe(null)
  })

  it('같은 반려견이면 바뀜이 아니다', () => {
    expect(changedPet(choco.petId, choco)).toBe(null)
  })

  it('둘 다 있고 다르면 새 반려견이다', () => {
    expect(changedPet('pet-SMALL', choco)).toBe(choco)
  })
})

/**
 * 기록 이동(뒤로 · 앞으로 가기) 뒤 다시 맞추기 — #1301 리뷰. 반려견을 바꾼 뒤 뒤로 가면 브라우저가 옛 반려견의
 * 체구 값 칸으로 간다. **이번 마운트에서 바꾼 적이 있을 때만** 다시 맞춘다 — 첫 로드 · 공유 링크는 그대로.
 */
describe('petSizeFiltersAfterHistory', () => {
  const choco = pet('LARGE', '대형견', null)

  it('바꾼 적이 있고 기록 이동 뒤 값이 다르면 지금 반려견 값으로 맞춘다', () => {
    expect(
      petSizeFiltersAfterHistory({
        changedThisMount: true,
        popped: true,
        filters: SMALL_ON,
        pet: choco,
      }),
    ).toEqual({ ...SMALL_ON, petSizeType: 'LARGE', petWeightKg: null })
  })

  it('이번 마운트에서 바꾼 적이 없으면 손대지 않는다 — 공유 링크 칸으로 돌아간 것이다', () => {
    expect(
      petSizeFiltersAfterHistory({
        changedThisMount: false,
        popped: true,
        filters: SMALL_ON,
        pet: choco,
      }),
    ).toBe(null)
  })

  it('기록 이동이 아니면 손대지 않는다', () => {
    expect(
      petSizeFiltersAfterHistory({
        changedThisMount: true,
        popped: false,
        filters: SMALL_ON,
        pet: choco,
      }),
    ).toBe(null)
  })

  it('체구 필터가 꺼져 있거나 이미 같으면 할 일이 없다 · 반려견이 없으면 없다', () => {
    const base = { changedThisMount: true, popped: true }
    expect(
      petSizeFiltersAfterHistory({ ...base, filters: DEFAULT_PLACE_FILTERS, pet: choco }),
    ).toBe(null)
    expect(
      petSizeFiltersAfterHistory({
        ...base,
        filters: { ...SMALL_ON, petSizeType: 'LARGE', petWeightKg: null },
        pet: choco,
      }),
    ).toBe(null)
    expect(petSizeFiltersAfterHistory({ ...base, filters: SMALL_ON, pet: null })).toBe(null)
  })
})
