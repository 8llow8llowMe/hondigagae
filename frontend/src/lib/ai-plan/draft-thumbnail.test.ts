import { describe, expect, it } from 'vitest'

import { draftItemThumbnail, settledDraftThumbnail } from '@/lib/ai-plan/draft-thumbnail'
import { aiPlanItem } from '@/test/fixtures/ai-plan'

const SMALL = 'http://tong.visitkorea.or.kr/cms/resource/01/1_image3_1.jpg'
const LARGE = 'http://tong.visitkorea.or.kr/cms/resource/01/1_image2_1.jpg'

describe('settledDraftThumbnail — 보강 결과에서 썸네일 꺼내기 (#1127)', () => {
  it('보강 중이면 undefined 다 — 사진 없음으로 단정하지 않는다', () => {
    expect(settledDraftThumbnail({ pending: true, detail: undefined })).toBeUndefined()
  })

  it('작은 사진(firstImage2)이 먼저고 https 로 올린다 — 목록 썸네일과 같은 규칙 (#1132)', () => {
    expect(
      settledDraftThumbnail({
        pending: false,
        detail: { firstImage: LARGE, firstImage2: SMALL },
      }),
    ).toBe(SMALL.replace('http:', 'https:'))
  })

  it('작은 사진이 없으면 큰 사진을 쓴다', () => {
    expect(
      settledDraftThumbnail({ pending: false, detail: { firstImage: LARGE, firstImage2: null } }),
    ).toBe(LARGE.replace('http:', 'https:'))
  })

  it('사진이 없는 장소는 null 이다 — 확정된 "없음" 이라 일러스트로 떨어진다', () => {
    expect(
      settledDraftThumbnail({ pending: false, detail: { firstImage: null, firstImage2: null } }),
    ).toBeNull()
  })

  it('허용 목록 밖 호스트는 null 이다 — next/image 가 런타임에 던지지 않게', () => {
    expect(
      settledDraftThumbnail({
        pending: false,
        detail: { firstImage: 'https://example.com/a.jpg', firstImage2: null },
      }),
    ).toBeNull()
  })

  it('보강이 실패하면(404 병합 · 5xx) null 이다 — 회색으로 기다리게 두지 않는다', () => {
    expect(settledDraftThumbnail({ pending: false, detail: undefined })).toBeNull()
  })
})

describe('draftItemThumbnail — 항목 한 줄의 썸네일 (#1127)', () => {
  const thumbnails: ReadonlyMap<string, string | null> = new Map([
    ['1', 'https://tong.visitkorea.or.kr/a.jpg'],
    ['2', null],
  ])

  it('보강이 끝난 장소는 그 값을 쓴다', () => {
    expect(draftItemThumbnail(aiPlanItem({ placeId: '1' }), thumbnails)).toBe(
      'https://tong.visitkorea.or.kr/a.jpg',
    )
    expect(draftItemThumbnail(aiPlanItem({ placeId: '2' }), thumbnails)).toBeNull()
  })

  it('아직 보강되지 않은 장소는 undefined 다', () => {
    expect(draftItemThumbnail(aiPlanItem({ placeId: '3' }), thumbnails)).toBeUndefined()
  })

  it('placeId 가 null 인 항목은 기다리지 않고 바로 null 이다 — 요청 자체가 없다', () => {
    expect(draftItemThumbnail(aiPlanItem({ placeId: null }), thumbnails)).toBeNull()
  })
})
