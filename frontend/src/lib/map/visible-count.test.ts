import { describe, expect, it } from 'vitest'

import { visibleCountLabel } from '@/lib/map/visible-count'
import { messages } from '@/lib/messages'

/*
  **두 지도 화면이 같이 쓰는 캡션이다** — `/emergency` 는 선택·stale 구간에서,
  `/places` 는 지도가 마지막 조회 자리에서 벗어났을 때 "지도에 보이는" 주장을 뺀다.
  이 함수는 둘을 구분하지 않는다: 주장을 하면 안 되는 상태는 하나의 `true` 다.
*/

describe('visibleCountLabel', () => {
  it('주장해도 되는 상태에서는 messages.map.visibleCount 를 쓴다 — "지도에 보이는" 이 참인 상태다', () => {
    expect(visibleCountLabel(12, false)).toBe(messages.map.visibleCount.replace('{n}', '12'))
  })

  it('선택 중일 때는 messages.map.listCount 를 쓴다 — 지도 프레임과 목록이 어긋난 뒤라 "보이는" 이라고 말하지 않는다', () => {
    expect(visibleCountLabel(12, true)).toBe(messages.map.listCount.replace('{n}', '12'))
  })

  it('개수 자체는 선택 여부와 무관하게 그대로 진실이다', () => {
    const unselected = visibleCountLabel(4, false)
    const selected = visibleCountLabel(4, true)

    expect(unselected).toContain('4')
    expect(selected).toContain('4')
    // 문구가 다르다는 것도 함께 고정한다 — 같으면 B1 회귀다
    expect(unselected).not.toBe(selected)
  })

  it('해제됐지만 bounds 가 아직 stale 인 상태도 같은 두 번째 인자로 표현된다 — "지도에 보이는" 을 쓰지 않는다', () => {
    // `EmergencyMapView` 는 `selectedId !== null || boundsStale` 를 이 함수의
    // 두 번째 인자로 넘긴다. 이 함수 입장에서는 "선택 중"과 "해제됐지만 stale"을
    // 구분하지 않는다 — 둘 다 지도 프레임에 대한 주장을 하면 안 되는 상태라
    // 같은 `true` 로 들어오고, 같은 문구("목록 {n}곳")를 낸다.
    const deselectedButStale = visibleCountLabel(136, true)

    expect(deselectedButStale).toBe(messages.map.listCount.replace('{n}', '136'))
    expect(deselectedButStale).not.toBe(messages.map.visibleCount.replace('{n}', '136'))
  })
})
