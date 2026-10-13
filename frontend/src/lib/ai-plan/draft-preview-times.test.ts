import { describe, expect, it } from 'vitest'

import { draftDayPreviewTimes, draftToPlanPayload } from '@/lib/ai-plan/draft-to-plan'
import type { LatLng } from '@/lib/geo/coord'
import { aiPlanDraft, aiPlanItem, aiPlanSnapshot as snapshot } from '@/test/fixtures/ai-plan'
import type { AiPlanDayItem } from '@/types/ai-plan'

/**
 * 미리보기 시각 = 담기 시각 (#1432 · 공통명세 S11-1).
 *
 * 미리보기가 말한 시각과 저장된 시각이 다르면 "미리 보여 준다" 는 약속이 거짓이 된다. 두 화면이
 * **같은 함수**를 쓰는지는 결과로만 확인할 수 있다 — 같은 초안 · 같은 제외 · 같은 좌표에서
 * 미리보기가 원본 행마다 낸 시각을, 담기 본문의 `startTime` 과 행 단위로 맞춰 본다.
 */

const JOB_ID = '8a64f9c0-2f1e-4c1a-9c3e-000000000001'

/** 제주시 · 애월 · 협재 — 직선 수 km~수십 km 라 이동 시간이 최소값(10분)과 달라진다 */
const COORDS = new Map<string, LatLng>([
  ['100', { lat: 33.4996, lng: 126.5312 }],
  ['200', { lat: 33.4628, lng: 126.3094 }],
  ['300', { lat: 33.394, lng: 126.2397 }],
  ['400', { lat: 33.2541, lng: 126.56 }],
])

const DAY: AiPlanDayItem = {
  day: 1,
  items: [
    aiPlanItem({ placeId: '100', itemType: 'PLACE', title: '동문시장' }),
    // 제목이 비면 담기가 뺀다 — 미리보기도 시각을 주지 않아야 뒤 항목 시각이 같다
    aiPlanItem({ placeId: null, itemType: 'PLACE', title: '  ' }),
    aiPlanItem({ placeId: '200', itemType: 'MEAL', title: '애월 카페거리' }),
    // 모르는 유형(LLM raw string)도 담기가 뺀다
    aiPlanItem({ placeId: '250', itemType: 'SHOPPING', title: '기념품' }),
    aiPlanItem({ placeId: '300', itemType: 'PLACE', title: '협재해수욕장' }),
    aiPlanItem({ placeId: '400', itemType: 'LODGING', title: '서귀포 숙소' }),
  ],
}

/** 담기 본문에서 그날 항목의 `startTime` 을 담기 순서대로 */
function savedTimes(
  days: AiPlanDayItem[],
  options: { excludedPlaceIds?: Set<string>; totalDays?: number } = {},
) {
  const { items = [] } = draftToPlanPayload({
    jobId: JOB_ID,
    draft: aiPlanDraft(days),
    snapshot,
    title: '제목',
    coords: COORDS,
    ...options,
  })

  return items.map((item) => ({ day: item.day, title: item.title, startTime: item.startTime }))
}

/** 미리보기가 원본 행마다 낸 시각을, 시각이 있는 행만 담기 순서대로 */
function previewTimes(
  days: AiPlanDayItem[],
  options: { excludedPlaceIds?: Set<string>; totalDays?: number } = {},
) {
  return days.flatMap((dayItem) => {
    const times = draftDayPreviewTimes(dayItem, {
      totalDays: options.totalDays ?? null,
      excludedPlaceIds: options.excludedPlaceIds,
      coords: COORDS,
    })

    return dayItem.items.map((item, index) => ({
      day: dayItem.day,
      title: (item.title ?? '').trim(),
      startTime: times[index],
    }))
  })
}

describe('draftDayPreviewTimes — 미리보기 시각은 담기 시각과 같다 (#1432)', () => {
  it('원본 행과 같은 길이로 돌려준다 — 행 index 로 바로 꺼낸다', () => {
    expect(draftDayPreviewTimes(DAY, { totalDays: 3, coords: COORDS })).toHaveLength(
      DAY.items.length,
    )
  })

  it('담기가 싣는 항목마다 담기의 startTime 과 같은 값이다', () => {
    const saved = savedTimes([DAY])
    const shown = previewTimes([DAY]).filter((row) => saved.some((s) => s.title === row.title))

    expect(shown).toEqual(saved)
    // 시각이 실제로 채워졌는지도 본다 — 둘 다 비어 같으면 이 테스트는 아무것도 말하지 않는다
    expect(saved.every((row) => row.startTime !== undefined)).toBe(true)
  })

  it('담기가 빼는 행(빈 제목 · 모르는 유형)에는 시각이 없다', () => {
    const times = draftDayPreviewTimes(DAY, { totalDays: 3, coords: COORDS })

    expect(times[1]).toBeUndefined()
    expect(times[3]).toBeUndefined()
  })

  it('빼기로 표시한 장소는 시각이 없고, 뒤 항목은 그 장소를 건너뛴 담기 시각을 말한다', () => {
    const excludedPlaceIds = new Set(['200'])
    const times = draftDayPreviewTimes(DAY, { totalDays: 3, excludedPlaceIds, coords: COORDS })

    expect(times[2]).toBeUndefined()
    expect(previewTimes([DAY], { excludedPlaceIds }).filter((row) => row.startTime)).toEqual(
      savedTimes([DAY], { excludedPlaceIds }),
    )
    // 빼기 전과 다른 시각이어야 "다시 계산했다" 가 증명된다
    expect(times[4]).not.toBe(draftDayPreviewTimes(DAY, { totalDays: 3, coords: COORDS })[4])
  })

  it('기간 밖 일차는 담기가 버리므로 시각이 하나도 없다', () => {
    const outside: AiPlanDayItem = { ...DAY, day: 4 }

    expect(draftDayPreviewTimes(outside, { totalDays: 3, coords: COORDS })).toEqual(
      DAY.items.map(() => undefined),
    )
    expect(savedTimes([outside], { totalDays: 3 })).toEqual([])
  })

  it('일차가 1보다 작으면(@Min(1)) 시각이 없다', () => {
    const zero: AiPlanDayItem = { ...DAY, day: 0 }

    expect(draftDayPreviewTimes(zero, { totalDays: null }).every((t) => t === undefined)).toBe(true)
  })

  it('여러 날이어도 날마다 10:00 부터 다시 잇는다 — 담기와 같다', () => {
    const second: AiPlanDayItem = { ...DAY, day: 2 }

    expect(previewTimes([DAY, second]).filter((row) => row.startTime)).toEqual(
      savedTimes([DAY, second]),
    )
    expect(draftDayPreviewTimes(second, { totalDays: 3, coords: COORDS })[0]).toBe('10:00:00')
  })
})
