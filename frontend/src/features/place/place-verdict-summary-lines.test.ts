import { describe, expect, it } from 'vitest'

import { VERDICT_ANCHOR, verdictSummaryLines } from '@/features/place/place-verdict-summary-lines'
import { messages } from '@/lib/messages'
import {
  congestion as congestionFixture,
  congestionAllUnknown,
  walkSafety as walkSafetyFixture,
} from '@/test/fixtures/insight'
import { placeDetail, placeDetailWithoutOptionalSections } from '@/test/fixtures/place'
import type { PlaceCongestionResponse, WalkSafetyResponse } from '@/types/insight'
import type { PlaceDetail } from '@/types/place'

/**
 * 장소 상세 판정 요약 3줄 — 무엇을 보여줄지 (#650 · 진단 D-1).
 *
 * 정본: `docs/features/place/장소상세-판정요약-세부명세.md` D4 · D7.
 */

type WalkSource = { data: WalkSafetyResponse | null; loading: boolean; failed: boolean }
type CongestionSource = { data: PlaceCongestionResponse | null; loading: boolean; failed: boolean }

const walkOk: WalkSource = { data: walkSafetyFixture, loading: false, failed: false }
const walkLoading: WalkSource = { data: null, loading: true, failed: false }
const walkFailed: WalkSource = { data: null, loading: false, failed: true }

const congestionOk: CongestionSource = { data: congestionFixture, loading: false, failed: false }
const congestionLoading: CongestionSource = { data: null, loading: true, failed: false }
const congestionFailed: CongestionSource = { data: null, loading: false, failed: true }
const congestionNoDay: CongestionSource = {
  data: congestionAllUnknown,
  loading: false,
  failed: false,
}

const labelsOf = (
  place: PlaceDetail,
  walk: WalkSource = walkOk,
  congestion: CongestionSource = congestionOk,
) => verdictSummaryLines(place, walk, congestion).map((line) => line.label)

const valueOf = (
  label: string,
  place: PlaceDetail,
  walk: WalkSource = walkOk,
  congestion: CongestionSource = congestionOk,
) =>
  verdictSummaryLines(place, walk, congestion).find((line) => line.label === label)?.value ?? null

describe('verdictSummaryLines — 동반 줄', () => {
  /*
    `place` 가 없으면 이 화면 자체가 렌더되지 않는다. 그래서 동반은 **판정 둘이 다 죽어도**
    남는 유일한 줄이고, 요약 블록이 통째로 비는 일이 없다는 보장이기도 하다.
  */
  it('언제나 선다', () => {
    expect(labelsOf(placeDetail)).toContain(messages.place.detailSummaryPetLabel)
  })

  it('판정 둘 다 실패해도 남는다', () => {
    const labels = labelsOf(placeDetail, walkFailed, congestionFailed)

    expect(labels).toEqual([messages.place.detailSummaryPetLabel])
  })

  it('UNKNOWN 은 불가로 단정하지 않고 정보 없음으로 말한다', () => {
    const unknown: PlaceDetail = {
      ...placeDetail,
      petAllowanceType: { code: 'UNKNOWN', name: '정보 없음', description: null },
    }

    expect(valueOf(messages.place.detailSummaryPetLabel, unknown)).toBe(
      messages.place.detailSummaryPetUnknown,
    )
  })

  /*
    태그 줄은 `UNKNOWN` 배지를 감추지만(#530 — 옆 태그에 걸려 읽힌다) 요약은 말한다.
    **감추는 것과 단정하는 것은 다르다** — 이 단언이 그 구분을 잠근다.
  */
  it('UNKNOWN 이 아니면 서버 name 을 쓰고, petInfo 가 있으면 크기가 붙는다', () => {
    const value = valueOf(messages.place.detailSummaryPetLabel, placeDetail)

    expect(value).toContain(placeDetail.petAllowanceType.name)
    expect(value).toContain(placeDetail.petInfo?.allowedPetSize.name ?? '///')
  })

  it('petInfo 가 없으면 크기 없이 동반 조건만 말한다', () => {
    const value = valueOf(messages.place.detailSummaryPetLabel, placeDetailWithoutOptionalSections)

    expect(value).toBe(placeDetailWithoutOptionalSections.petAllowanceType.name)
  })
})

describe('verdictSummaryLines — 지금 산책 줄', () => {
  it('등급과 체감온도를 함께 말한다', () => {
    const value = valueOf(messages.place.detailSummaryWalkLabel, placeDetail)

    expect(value).toContain(walkSafetyFixture.walkSafetyLevel.name)
    expect(value).toContain('℃')
  })

  /*
    **`0.0℃` 로 채우면 영하 판정으로 읽힌다** — `PlaceWalkSafetyPanel` 이 hero 자리를
    비우는 것과 같은 근거다.
  */
  it('체감온도가 null 이면 등급만 말하고 ℃ 를 붙이지 않는다', () => {
    const noFeelsLike = {
      data: { ...walkSafetyFixture, feelsLikeCelsius: null },
      loading: false,
      failed: false,
    }
    const value = valueOf(messages.place.detailSummaryWalkLabel, placeDetail, noFeelsLike)

    expect(value).toBe(walkSafetyFixture.walkSafetyLevel.name)
    expect(value).not.toContain('℃')
  })

  /*
    아래 판정 카드가 이미 재시도 버튼을 갖고 있다. 죽은 줄을 남기면 앵커가 **갈 곳 없는
    링크**가 된다.
  */
  it('실패하면 줄을 만들지 않는다', () => {
    expect(labelsOf(placeDetail, walkFailed)).not.toContain(messages.place.detailSummaryWalkLabel)
  })

  it('data 가 null 이면 줄을 만들지 않는다', () => {
    const empty = { data: null, loading: false, failed: false }

    expect(labelsOf(placeDetail, empty)).not.toContain(messages.place.detailSummaryWalkLabel)
  })

  /* 로딩은 "없다" 가 아니라 "아직" 이다 — 자리를 지키지 않으면 값이 올 때 화면이 튄다 */
  it('로딩 중에는 자리를 지키고 값만 비운다', () => {
    const lines = verdictSummaryLines(placeDetail, walkLoading, congestionOk)
    const walk = lines.find((line) => line.label === messages.place.detailSummaryWalkLabel)

    expect(walk).toBeDefined()
    expect(walk?.value).toBeNull()
  })
})

describe('verdictSummaryLines — 덜 붐비는 날 줄', () => {
  it('서버가 고른 날을 혼잡도 패널과 같은 문구로 말한다', () => {
    const value = valueOf(messages.place.detailSummaryCongestionLabel, placeDetail)

    expect(value).toContain('9월 5일 (토)')
  })

  /*
    **기간이 전부 붐비는 주라면 가장 덜 붐비는 날도 `혼잡` 이다.** 그때 날짜만 내면 이 줄이
    추천처럼 읽힌다 — 혼잡도 패널이 같은 이유로 초록 면을 거절하고 등급 배지를 반드시
    붙인다 (`LeastCrowded` 주석).
  */
  it('등급을 함께 말한다 — 전부 붐비는 주에도 추천처럼 읽히지 않는다', () => {
    const crowded: CongestionSource = {
      data: {
        ...congestionFixture,
        leastCrowded: {
          date: '2026-09-05',
          level: { code: 'HIGH', name: '혼잡', description: null },
          concentrationRate: 88.1,
        },
      },
      loading: false,
      failed: false,
    }
    const value = valueOf(messages.place.detailSummaryCongestionLabel, placeDetail, walkOk, crowded)

    expect(value).toContain('혼잡')
  })

  /*
    혼잡도 패널의 `LeastCrowded` 도 같은 방어를 갖고 있다 — `splitDay` 가 `null` 이면
    아무것도 그리지 않는다. 두 곳이 함께 움직여야 하는 분기다.
  */
  it('날짜를 읽을 수 없으면 줄을 만들지 않는다', () => {
    const broken: CongestionSource = {
      data: {
        ...congestionFixture,
        leastCrowded: { ...congestionFixture.leastCrowded!, date: '날짜아님' },
      },
      loading: false,
      failed: false,
    }

    expect(labelsOf(placeDetail, walkOk, broken)).not.toContain(
      messages.place.detailSummaryCongestionLabel,
    )
  })

  /*
    **`leastCrowded === null` 은 "한산" 이 아니라 "아는 날이 하나도 없다" 다**
    (`types/insight.ts`). 빈 자리를 두면 "한산한 날이 없다" 로 읽힌다.
  */
  it('leastCrowded 가 null 이면 줄을 만들지 않는다', () => {
    expect(labelsOf(placeDetail, walkOk, congestionNoDay)).not.toContain(
      messages.place.detailSummaryCongestionLabel,
    )
  })

  it('실패하면 줄을 만들지 않는다', () => {
    expect(labelsOf(placeDetail, walkOk, congestionFailed)).not.toContain(
      messages.place.detailSummaryCongestionLabel,
    )
  })

  it('로딩 중에는 자리를 지키고 값만 비운다', () => {
    const lines = verdictSummaryLines(placeDetail, walkOk, congestionLoading)
    const day = lines.find((line) => line.label === messages.place.detailSummaryCongestionLabel)

    expect(day).toBeDefined()
    expect(day?.value).toBeNull()
  })
})

describe('verdictSummaryLines — 순서와 앵커', () => {
  it('동반 · 지금 산책 · 덜 붐비는 날 순서다', () => {
    expect(labelsOf(placeDetail)).toEqual([
      messages.place.detailSummaryPetLabel,
      messages.place.detailSummaryWalkLabel,
      messages.place.detailSummaryCongestionLabel,
    ])
  })

  it('각 줄이 자기 섹션 id 를 가리킨다', () => {
    const lines = verdictSummaryLines(placeDetail, walkOk, congestionOk)

    expect(lines.map((line) => line.anchorId)).toEqual([
      VERDICT_ANCHOR.pet,
      VERDICT_ANCHOR.walk,
      VERDICT_ANCHOR.congestion,
    ])
  })
})
