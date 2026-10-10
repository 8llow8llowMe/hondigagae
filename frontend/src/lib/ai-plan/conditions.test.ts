import { describe, expect, it } from 'vitest'

import { snapshotFromConditions } from '@/lib/ai-plan/conditions'
import type { AiPlanJobConditions } from '@/types/ai-plan'

/**
 * 서버 생성 조건 → 화면 보관본 — 이슈 #498 (서버 쪽은 #488).
 *
 * **여기서 잠그는 것은 "다른 브라우저에서도 담을 수 있다" 의 근거다.** 조건이
 * `sessionStorage` 에만 있던 동안 대기 화면의 약속은 보기까지만 참이었다.
 */
const CONDITIONS: AiPlanJobConditions = {
  areaCode: '39',
  sigunguCode: '4',
  startDate: '2026-09-11',
  endDate: '2026-09-13',
  petIds: ['123456789012000001', '123456789012000002'],
  budget: 400_000,
  requestNote: '산책 위주로 부탁해요',
}

const NAMES: Record<string, string> = {
  '123456789012000001': '몽실이',
  '123456789012000002': '까미',
}

const nameOf = (petId: string) => NAMES[petId] ?? ''

describe('snapshotFromConditions — 서버 조건으로 담기를 되살린다 (#498)', () => {
  it('담기에 필요한 값을 그대로 옮긴다', () => {
    const snapshot = snapshotFromConditions(CONDITIONS, nameOf)

    expect(snapshot).not.toBeNull()
    expect(snapshot?.areaCode).toBe('39')
    expect(snapshot?.startDate).toBe('2026-09-11')
    expect(snapshot?.endDate).toBe('2026-09-13')
    expect(snapshot?.budget).toBe(400_000)
  })

  /*
    **순서가 계약이다** — 담기는 `petIds[0]` 을 대표 반려견으로 박아 넣는다
    (`PlanCreateRequest`). 순서가 흔들리면 일정이 다른 아이에게 붙는다.
  */
  it('반려견 순서를 지키고 이름을 목록에서 맞춘다', () => {
    const snapshot = snapshotFromConditions(CONDITIONS, nameOf)

    expect(snapshot?.pets).toEqual([
      { petId: '123456789012000001', name: '몽실이' },
      { petId: '123456789012000002', name: '까미' },
    ])
  })

  /*
    이름은 **일정 제목 기본값에만** 쓰인다. 목록을 아직 못 받았어도 담기가 막히면 안 된다.
  */
  it('이름을 못 찾아도 담기는 막지 않는다 — 빈 이름으로 둔다', () => {
    const snapshot = snapshotFromConditions(CONDITIONS, () => '')

    expect(snapshot?.pets.map((pet) => pet.petId)).toEqual(CONDITIONS.petIds)
    expect(snapshot?.pets.every((pet) => pet.name === '')).toBe(true)
  })

  /*
    **제출 본문으로 다시 나가는 값이라 빠뜨리면 조건이 말없이 넓어진다**
    (`AiPlanRequestSnapshot.sigunguCode`).
  */
  it('sigunguCode 를 옮긴다 — null 도 그대로다 (제주 전체)', () => {
    expect(snapshotFromConditions(CONDITIONS, nameOf)?.sigunguCode).toBe('4')
    expect(snapshotFromConditions({ ...CONDITIONS, sigunguCode: null }, nameOf)?.sigunguCode).toBe(
      null,
    )
  })

  it('requestNote 가 null 이면 빈 문자열로 맞춘다 — 보관본의 "없음" 표기다', () => {
    expect(snapshotFromConditions({ ...CONDITIONS, requestNote: null }, nameOf)?.requestNote).toBe(
      '',
    )
  })

  /*
    **서버 계약에 아예 없는 둘이다.** 빈 값으로 채우면 "같은 조건으로 다시 만들기" 가 그
    빈 값을 사실로 알고 재제출한다 — 꼭 넣으라고 고른 장소가 조용히 빠진다.
  */
  it('pinnedPlaces · preferFavorites 를 지어내지 않는다', () => {
    const snapshot = snapshotFromConditions(CONDITIONS, nameOf)

    expect(snapshot).not.toHaveProperty('pinnedPlaces')
    expect(snapshot).not.toHaveProperty('preferFavorites')
  })

  it('조건 블록이 null 이면 복원하지 않는다', () => {
    expect(snapshotFromConditions(null, nameOf)).toBeNull()
  })

  /*
    **짐작하지 않는다.** 서버는 빈 배열을 "회원의 대표 반려견으로 짰다" 는 뜻으로 쓰는데
    어느 아이였는지는 응답에 없다 — 목록의 첫 아이로 채우면 **다른 아이에게 일정이 붙는다.**
  */
  it('petIds 가 비면 복원하지 않는다 — 어느 아이인지 알 수 없다', () => {
    expect(snapshotFromConditions({ ...CONDITIONS, petIds: [] }, nameOf)).toBeNull()
  })
})
