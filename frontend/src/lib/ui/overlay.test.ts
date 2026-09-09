import { describe, expect, it } from 'vitest'

import { nextFocusIndex, tabbableOf } from '@/lib/ui/overlay'

/*
  `useOverlay` 자체는 여기서 검증하지 않는다 — 이 저장소는 node 환경이라 effect 도
  포커스도 돌지 않는다. Tab 순환에서 실제로 틀리는 두 조각(로빙 tabindex 거르기, 끝에서
  감기)만 순수 함수로 떼어 두었고, 이 파일은 그 둘을 본다.
*/

describe('tabbableOf — 로빙 tabindex 를 걷어낸다', () => {
  it('tabIndex 가 -1 인 것은 탭 정지가 아니다', () => {
    const elements = [{ tabIndex: 0 }, { tabIndex: -1 }, { tabIndex: 0 }]

    expect(tabbableOf(elements)).toEqual([{ tabIndex: 0 }, { tabIndex: 0 }])
  })

  it('달력 격자는 칸이 몇 개든 탭 정지 하나로 줄어든다', () => {
    // 나흘 격자에서 셋째 칸만 포커스를 든 상태 — 앞뒤의 달 이동 버튼과 함께 온다
    const panel = [
      { name: '이전 해', tabIndex: 0 },
      { name: '이전 달', tabIndex: 0 },
      { name: '1일', tabIndex: -1 },
      { name: '2일', tabIndex: -1 },
      { name: '3일', tabIndex: 0 },
      { name: '4일', tabIndex: -1 },
      { name: '다음 달', tabIndex: 0 },
      { name: '다음 해', tabIndex: 0 },
    ]

    expect(tabbableOf(panel).map((element) => element.name)).toEqual([
      '이전 해',
      '이전 달',
      '3일',
      '다음 달',
      '다음 해',
    ])
  })

  it('빈 목록은 빈 목록이다 — 가둘 것이 없으면 트랩도 없다', () => {
    expect(tabbableOf([])).toEqual([])
  })
})

describe('nextFocusIndex — 끝에서 감는다', () => {
  it('Tab 은 다음으로 간다', () => {
    expect(nextFocusIndex(1, 5, false)).toBe(2)
  })

  it('Shift+Tab 은 이전으로 간다', () => {
    expect(nextFocusIndex(3, 5, true)).toBe(2)
  })

  it('마지막에서 Tab 은 처음으로 감긴다 — 여기가 트랩이 하는 일이다', () => {
    expect(nextFocusIndex(4, 5, false)).toBe(0)
  })

  it('처음에서 Shift+Tab 은 마지막으로 감긴다', () => {
    expect(nextFocusIndex(0, 5, true)).toBe(4)
  })

  it('초점이 목록 밖(-1)이면 Tab 은 첫 정지로 들어간다', () => {
    // 패널 자신이 tabIndex={-1} 로 초점을 들고 있는, 열자마자의 상태
    expect(nextFocusIndex(-1, 5, false)).toBe(0)
  })

  it('초점이 목록 밖(-1)이면 Shift+Tab 은 마지막 정지로 들어간다', () => {
    expect(nextFocusIndex(-1, 5, true)).toBe(4)
  })

  it('탭 정지가 하나뿐이면 어느 쪽이든 제자리다', () => {
    expect(nextFocusIndex(0, 1, false)).toBe(0)
    expect(nextFocusIndex(0, 1, true)).toBe(0)
  })
})
