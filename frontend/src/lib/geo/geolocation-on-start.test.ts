import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'

/*
  **화면 진입에서 위치 권한을 묻지 않는다** (#1133).

  Lighthouse(2026-10-03, dev) 가 홈과 `/places` 를 `geolocation-on-start` 로 잡았다 —
  마운트 effect 가 `getCurrentPosition()` 을 불러 들어오자마자 권한 팝업이 떴다.
  진입에서는 `getPositionIfGranted()`(이미 허용된 경우만 읽는다)를 쓰고, 묻는 것은
  사용자가 누른 "내 위치" 버튼의 몫이다.

  effect 는 node 환경에서 돌지 않으므로(`testing-guide.md` §1) 호출 자리를 소스로 잠근다.
  주석을 걷고 읽는다 — 이 파일들의 주석에 두 함수 이름이 그대로 등장한다.
*/
describe('화면 진입에서 위치 권한을 묻지 않는다', () => {
  it('홈은 묻는 함수를 부르지 않는다 — 진입 좌표는 허용된 경우에만 읽는다', () => {
    const source = readSourceWithoutComments('src/features/home/home-view.tsx')

    expect(source).toMatch(/useEffect\(\(\) => \{\s*void getPositionIfGranted\(\)/)
    expect(source).not.toContain('getCurrentPosition')
  })

  it('/places 지도는 마운트에서 묻지 않고, "내 위치" 를 누를 때만 묻는다', () => {
    const source = readSourceWithoutComments('src/features/place/place-map-view.tsx')

    expect(source).toMatch(/useEffect\(\(\) => \{\s*void getPositionIfGranted\(\)/)

    const asks = [...source.matchAll(/getCurrentPosition\(\)/g)]
    expect(asks).toHaveLength(1)

    // 그 한 번은 버튼 핸들러 안이다
    const locateStart = source.indexOf('const locate = useCallback(')
    const locateEnd = source.indexOf('}, [])', locateStart)
    expect(locateStart).toBeGreaterThan(-1)
    expect(asks[0]?.index).toBeGreaterThan(locateStart)
    expect(asks[0]?.index).toBeLessThan(locateEnd)
  })

  /*
    **긴급 시설은 의도된 예외다.** 가까운 병원·약국을 거리순으로 찾으러 들어오는 화면이라
    진입 자체가 "내 위치로 찾아 달라" 는 요청이고, 급할 때 버튼 한 번을 더 누르게 하지
    않는다. 거부해도 제주 중심 폴백과 `내 위치로 가까운 병원 찾기` 가 화면을 지킨다.
    이 단언이 깨지면 그 판단을 다시 하라는 뜻이다.
  */
  it('긴급 시설은 진입에서 묻는다 — 위치가 그 화면의 목적이다', () => {
    const source = readSourceWithoutComments('src/features/emergency/use-emergency-board.ts')

    expect(source).toMatch(/useEffect\(\(\) => \{\s*void getCurrentPosition\(\)/)
    expect(source).not.toContain('getPositionIfGranted')
  })
})
