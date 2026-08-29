import { describe, expect, it } from 'vitest'

import { petInfoLines, sizeVerdictLine } from '@/features/place/place-pet-info'
import { messages } from '@/lib/messages'
import { placeDetail } from '@/test/fixtures/place'

const petInfo = placeDetail.petInfo as NonNullable<typeof placeDetail.petInfo>

describe('petInfoLines — 값이 없는 줄은 만들지 않는다', () => {
  it('가공값 2종을 맨 앞에 둔다 — "들어갈 수 있는가" 가 첫 질문이다', () => {
    const lines = petInfoLines(petInfo, null)

    expect(lines[0]?.label).toBe(messages.place.detailPetScope)
    expect(lines[1]?.label).toBe(messages.place.detailPetSize)
  })

  it('가공값은 name 이 아니라 서버 description 문장을 쓴다', () => {
    const lines = petInfoLines(petInfo, null)

    expect(lines[0]?.value).toBe(petInfo.allowanceScope.description)
  })

  it('description 이 없으면 name 으로 떨어진다 — 모르는 code 에서도 줄이 비지 않는다', () => {
    const lines = petInfoLines(
      { ...petInfo, allowanceScope: { code: 'NEW', name: '새 구역', description: null } },
      null,
    )

    expect(lines[0]?.value).toBe('새 구역')
  })

  it('원문이 전부 비면 가공값 2줄만 남는다', () => {
    const lines = petInfoLines(
      {
        ...petInfo,
        acmpyTypeCd: null,
        acmpyPsblCpam: null,
        acmpyNeedMtr: null,
        etcAcmpyInfo: null,
        relaAcdntRiskMtr: null,
        relaFrnshPrdlst: null,
        relaPosesFclty: null,
        relaPurcPrdlst: null,
        relaRntlPrdlst: null,
      },
      null,
    )

    expect(lines).toHaveLength(2)
  })

  it('원천 표기(chkPet)는 참고 값이라 맨 뒤에 붙는다', () => {
    const lines = petInfoLines(petInfo, '애완동물 동반 가능')

    expect(lines.at(-1)?.label).toBe(messages.place.detailPetSourceText)
  })
})

describe('sizeVerdictLine — 규정을 옮기는 것과 판단을 돕는 것은 다르다', () => {
  it('반려견이 없으면 대입할 기준이 없어 줄을 만들지 않는다', () => {
    expect(sizeVerdictLine(petInfo, null, 'SMALL', '소형견')).toBeNull()
  })

  it('받아 주면 반려견 이름과 크기를 넣어 말한다', () => {
    const line = sizeVerdictLine(petInfo, '몽실이', 'SMALL', '소형견')

    expect(line).toBe(
      messages.place.detailPetSizeAllowed.replace('{name}', '몽실이').replace('{size}', '소형견'),
    )
  })

  it('SMALL_ONLY 에 대형견이면 들어가기 어렵다고 말한다', () => {
    const line = sizeVerdictLine(
      {
        ...petInfo,
        allowedPetSize: { code: 'SMALL_ONLY', name: '소형견만 가능', description: null },
      },
      '초코',
      'LARGE',
      '대형견',
    )

    expect(line).toBe(
      messages.place.detailPetSizeBlocked.replace('{name}', '초코').replace('{size}', '대형견'),
    )
  })

  it('UNKNOWN 을 "불가" 로 말하지 않는다 — 판단할 수 없다고만 말한다', () => {
    const line = sizeVerdictLine(
      { ...petInfo, allowedPetSize: { code: 'UNKNOWN', name: '정보 없음', description: null } },
      '몽실이',
      'LARGE',
      '대형견',
    )

    expect(line).toBe(messages.place.detailPetSizeUnknown.replace('{name}', '몽실이'))
  })
})
