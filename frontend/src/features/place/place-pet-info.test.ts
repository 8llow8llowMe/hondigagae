import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { petInfoLines, PlacePetInfoSection, sizeVerdictLine } from '@/features/place/place-pet-info'
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
        leashRequired: false,
      },
      null,
    )

    expect(lines).toHaveLength(2)
  })

  it('목줄이 필요하면 크기 다음에 줄이 선다 (#1226)', () => {
    const lines = petInfoLines({ ...petInfo, leashRequired: true }, null)

    expect(lines[2]).toEqual({
      label: messages.place.detailPetLeash,
      value: messages.place.detailPetLeashRequired,
    })
  })

  it('목줄이 필요 없다고 오면 줄을 만들지 않는다 — `false` 를 "필요 없음" 으로 단정하지 않는다', () => {
    const lines = petInfoLines({ ...petInfo, leashRequired: false }, null)

    expect(lines.map((line) => line.label)).not.toContain(messages.place.detailPetLeash)
  })

  it('원문 표기(chkPet)는 참고 값이라 맨 뒤에 붙는다', () => {
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

    // 템플릿을 다시 조립해 비교하지 않는다 — 치환자 이름이 바뀌면 `.replace` 가 조용히
    // 아무것도 안 해 **템플릿을 템플릿과 비교하는** 통과가 된다. 조사까지 글자로 적는다 (#558)
    expect(line).toBe('몽실이(소형견)은 들어갈 수 있어요.')
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

    expect(line).toBe('초코(대형견)은 들어가기 어려울 수 있어요.')
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

function renderWithPet(petName: string | null) {
  return renderToStaticMarkup(
    createElement(PlacePetInfoSection, {
      petInfo,
      allowance: placeDetail.petAllowanceType,
      sourceText: null,
      petName,
      petSizeCode: petName === null ? null : 'SMALL',
      petSizeName: petName === null ? null : '소형견',
    }),
  )
}

/*
  #1066 — 결론이 7줄 조건 목록의 **마지막 흐린 줄**이었다. "우리 아이는 되나" 가 이 절의 첫
  질문이라 맨 위로 올리고, 체크 아이콘이 붙는 목록 항목에서 뺀다 — `들어가기 어려울 수
  있어요` 에 초록 체크가 붙으면 결론과 아이콘이 반대 말을 한다.
*/
describe('PlacePetInfoSection — 우리 아이 기준 결론이 맨 위다 (#1066)', () => {
  const VERDICT = '몽실이(소형견)은 들어갈 수 있어요.'

  it('결론이 조건 목록보다 앞에 선다', () => {
    const html = renderWithPet('몽실이')

    expect(html.indexOf(VERDICT)).toBeGreaterThan(-1)
    expect(html.indexOf(VERDICT)).toBeLessThan(html.indexOf('<ul'))
    expect(html.indexOf(VERDICT)).toBeLessThan(html.indexOf(messages.place.detailPetScope))
  })

  it('결론은 체크 목록 항목이 아니다', () => {
    const html = renderWithPet('몽실이')
    const list = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'))

    expect(list).not.toContain(VERDICT)
    // 조건 줄 수만큼만 항목이 선다 — 결론 몫의 `li` 가 없다
    expect(list.split('<li').length - 1).toBe(petInfoLines(petInfo, null).length)
  })

  it('기준 반려견이 없으면 결론 없이 조건 목록부터 선다', () => {
    const html = renderWithPet(null)

    expect(html).not.toContain('들어갈 수 있어요')
    expect(html).toContain(messages.place.detailPetScope)
  })
})

function renderEmpty(allowance: { code: string; name: string; description: string | null } | null) {
  return renderToStaticMarkup(
    createElement(PlacePetInfoSection, {
      petInfo: null,
      allowance,
      sourceText: null,
      petName: null,
      petSizeCode: null,
      petSizeName: null,
    }),
  )
}

describe('petInfo 가 없을 때 — 동반 여부가 등록됐는지와 세부 조건이 있는지를 구분한다', () => {
  /*
    **실데이터가 이 분기를 만들게 했다.** dev 의 테지움사파리는 `petAllowanceType` 이
    `NOT_ALLOWED`(서버가 불가로 등록)인데 `petInfo` 가 null 이다. 그때 제목 옆 배지는
    "동반 불가" 인데 이 섹션은 "동반 가능 여부가 등록되지 않았어요" 라고 말해
    **한 화면이 두 말을 했다.** 명세가 세운 원칙(모름을 확신처럼 말하지 않는다)의
    반대 방향 — 확신을 모름처럼 말하는 것도 거짓이다.
  */
  it('동반 여부가 확정값이면 서버 문장을 쓰고 "등록되지 않았어요" 라고 말하지 않는다', () => {
    const html = renderEmpty({
      code: 'NOT_ALLOWED',
      name: '동반 불가',
      description: '반려동물 동반이 불가능한 장소입니다.',
    })

    expect(html).toContain('반려동물 동반이 불가능한 장소입니다.')
    expect(html).toContain(messages.place.detailPetInfoDetailsMissingText)
    expect(html).not.toContain(messages.place.detailPetInfoEmptyText)
  })

  it('동반 가능으로 등록된 곳도 같은 길을 탄다 — 세부 조건만 없다', () => {
    const html = renderEmpty({
      code: 'ALLOWED',
      name: '동반 가능',
      description: '반려동물 동반이 가능한 장소입니다.',
    })

    expect(html).toContain('반려동물 동반이 가능한 장소입니다.')
    expect(html).not.toContain(messages.place.detailPetInfoEmptyText)
  })

  /** `UNKNOWN` 은 실제로 모르는 것이라 기존 문구가 맞다 */
  it('UNKNOWN 이면 "등록되지 않았어요" 를 그대로 쓴다', () => {
    const html = renderEmpty({ code: 'UNKNOWN', name: '정보 없음', description: null })

    expect(html).toContain(messages.place.detailPetInfoEmptyText)
    expect(html).toContain(messages.place.detailPetInfoEmptyBadge)
  })

  it('동반 구분 자체가 없으면 모름으로 다룬다', () => {
    expect(renderEmpty(null)).toContain(messages.place.detailPetInfoEmptyText)
  })

  /** 다음 행동(전화)은 제목 머리의 방문 핵심 줄이 준다 (#1226) — 여기서 같은 번호를 다시 세우지 않는다 */
  it('전화 링크를 따로 세우지 않는다', () => {
    expect(renderEmpty(null)).not.toContain('tel:')
  })
})
