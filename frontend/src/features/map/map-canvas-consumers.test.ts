import { describe, expect, it } from 'vitest'

import { openingTags, readSourceWithoutComments } from '@/test/source'

/**
 * `MapCanvas` 를 쓰는 다섯 화면이 **어느 갈래에 서 있는가** — 이슈
 * [#789](https://github.com/8llow8llowMe/hondigagae/issues/789).
 *
 * ### 왜 소스를 읽나
 *
 * 갈래는 `onSelect` 를 넘기는가로 갈리는데, `MapCanvas` 는 `dynamic(..., { ssr: false })`
 * 라 **서버 렌더 결과에 아예 나오지 않는다** — 넘긴 prop 을 마크업으로 볼 방법이 없다
 * (`test/source.ts` 가 말하는 "한 파일에 없는 계약" 과 같은 처지다).
 *
 * ### 왜 잠그나
 *
 * **이 작업의 절반이 "기본값을 바꾸지 않는다" 다.** `onSelect` 를 옵셔널로 만든 순간,
 * 목록형 지도에서 그 prop 이 사라지면 **타입 오류 없이** 핀이 버튼에서 떨어지고 지도가
 * 안 움직이게 된다 — 컴파일러가 잡아 주지 않는 회귀다. #671 F-5 가 "배선이 안 잠겨
 * 생긴 항목" 이라고 지적한 그 자리다.
 */

/** 고를 것이 있는 지도. 핀을 눌러 목록과 대응시키고, 지도를 옮겨 재조회한다 */
const INTERACTIVE = [
  'src/features/place/place-map-view.tsx',
  'src/features/emergency/emergency-map-view.tsx',
  'src/features/plan/plan-route-card.tsx',
]

/** 고를 것이 없는 지도. 핀이 하나뿐이고 옮겨도 보여 줄 다른 것이 없다 */
const SINGLE_PIN = [
  'src/features/place/place-mini-map.tsx',
  'src/features/walk-course/walk-course-start-map.tsx',
]

function mapCanvasTag(path: string): string {
  const tags = openingTags(readSourceWithoutComments(path), /<MapCanvas\b/g)

  // 화면마다 지도는 하나다. 둘이 되면 갈래 판정이 이 테스트에서 흐려진다
  expect(tags).toHaveLength(1)

  return tags[0] as string
}

describe('MapCanvas 소비처 — 목록형 3종은 그대로다', () => {
  for (const path of INTERACTIVE) {
    it(`${path} 는 onSelect 를 넘긴다`, () => {
      expect(mapCanvasTag(path)).toContain('onSelect=')
    })
  }
})

describe('MapCanvas 소비처 — 단일 핀 지도는 onSelect 를 넘기지 않는다', () => {
  for (const path of SINGLE_PIN) {
    it(`${path} 는 onSelect 를 넘기지 않는다 — 그 부재가 갈래의 신호다`, () => {
      expect(mapCanvasTag(path)).not.toContain('onSelect')
    })

    /**
     * **이것이 #789 가 고친 결함 그 자체다.** 두 화면 다 `onSelect={() => undefined}` 를
     * 넘겨서, 핀이 `<button aria-pressed>` 로 그려지고 지도가 세로 스크롤을 먹었다.
     * 옵셔널로 바꾼 뒤에도 이 모양은 **타입이 통과**하므로 여기서 막는다.
     */
    it(`${path} 는 no-op 핸들러로 되돌아가지 않는다`, () => {
      expect(mapCanvasTag(path)).not.toContain('() => undefined')
    })
  }
})
