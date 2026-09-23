import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `PlaceMapView` 는 카카오 SDK·훅·브라우저 위치를 함께 쓰는 클라이언트 컴포넌트라 node
 * 환경에서 통째로 렌더할 수 없다. **배치는 소스에서 읽히므로** 그 자리를 여기서 잠근다 —
 * `emergency-map-view.test.ts` 가 같은 이유로 같은 방식을 쓴다.
 */
const source = readFileSync(fileURLToPath(new URL('./place-map-view.tsx', import.meta.url)), 'utf8')
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/*
  #901 **D2** — 시트 `max` 가 지도 위 검색·보기 전환을 덮지 않는다.

  예전에는 `sheetMaxTopInset` 을 준 화면(담기, #370)만 px 경로를 탔고 `/places` 자신은
  기본값(85dvh)으로 떨어졌다. 그 값은 **비율**이라 윗변이 기기 높이를 따라가 짧은 기기일수록
  자기 플로팅 컨트롤을 더 덮었다 — 812 에서 2px 여유, 800 에서 0, **640 에서 24px 덮음**.
*/
describe('PlaceMapView — 시트 최대 단계의 윗변 (#901 D2)', () => {
  it('호출부가 주지 않으면 MAP_TOP_CONTROLS_INSET 로 떨어진다 — 85dvh 가 아니다', () => {
    // `<MapSheet` 의 여는 태그 안에 `toolbar={<PlaceMapFilterBar … />}` 가 들어 있어
    // 첫 `>` 로 자르면 태그가 중간에서 끊긴다 — 문자열 자체가 충분히 고유하다
    expect(code).toContain('maxTopInset={sheetMaxTopInset ?? MAP_TOP_CONTROLS_INSET}')
    expect(code).toContain('import { MAP_TOP_CONTROLS_INSET, MapSheet')
  })

  /** 담기 화면(#370)이 자기 헤더 높이를 알려 주는 길은 그대로 남는다 */
  it('호출부가 준 값이 여전히 이긴다', () => {
    expect(code).toContain('sheetMaxTopInset?: number | undefined')
  })
})
