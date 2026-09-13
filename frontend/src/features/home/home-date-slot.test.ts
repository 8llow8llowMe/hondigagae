import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

/**
 * 홈 좌측 레일의 **날짜 자리**와 적합도 목록의 **첫 구분선** — 이슈 #530.
 *
 * ### 무엇이 문제였나
 *
 * 3a 로 바닥이 회색이 되면서(#428) 날짜 줄만 카드 밖에 떠 **어느 카드의 날짜인지 붙을
 * 곳이 없었다.** #428 은 데스크톱만 판정 패널로 들이고 모바일은 바닥 위에 남겨서,
 * **같은 줄이 폭에 따라 다른 물건**이 됐다.
 *
 * ### 왜 소스 단언인가
 *
 * `home-view.tsx` 는 `useQuery` 여섯을 부르는 client component 라 `renderToStaticMarkup`
 * 으로 세울 수 없다 — `QueryClientProvider` 와 `localStorage` · `geolocation` 까지
 * 필요하다. 이 저장소의 vitest 는 `environment: 'node'` 이고 jsdom 을 들이지 않는다
 * (`docs/testing-guide.md` §1). 그래서 **자리에 대한 계약**만 소스에서 잠근다 —
 * 렌더 결과(날짜 문자열 자체)는 `walk-verdict.test.ts` 가 본다.
 *
 * 실제 세로 위치·간격은 실측(375 / 768 / 1024 / 1280)이 본다.
 */
const HOME = source('src/features/home/home-view.tsx')

describe('홈 날짜 줄 — 카드 안 (#530)', () => {
  /*
    **`SurfaceStack` 직속 자식으로 돌아가면 다시 카드 밖이다.** 그 자리는 L0 바닥 위라
    카드에 붙을 곳이 없다 — 이 개정이 걷어낸 바로 그 모양이다.
  */
  it('날짜 줄이 `Surface` 안에 있다', () => {
    const stack = HOME.indexOf('<SurfaceStack')
    const surface = HOME.indexOf('<Surface>')
    const date = HOME.indexOf('{todayLabel}')

    expect(surface).toBeGreaterThan(stack)
    expect(date).toBeGreaterThan(surface)
  })

  /*
    **폭 분기가 없다.** 예전에는 `verdictShown && 'md:hidden'` 이라 데스크톱만 판정에
    날짜를 넘겼다. 이제 `WalkVerdict` 가 두 폭 모두 자기 자리에 그리므로, 이 자리는
    **판정이 없을 때만** 선다 — 폭이 아니라 상태가 가른다.
  */
  it('날짜 자리를 폭으로 가르지 않는다', () => {
    expect(HOME).not.toContain("verdictShown && 'md:hidden'")
    expect(HOME).toContain('{!verdictShown && (')
  })

  /*
    **판정이 없는 상태에도 날짜가 남는다** — 첫 방문자 · 404 로 기준을 버린 직후 ·
    조회 실패 · 로딩. `verdictShown` 이 `data !== undefined` 까지 보는 이유다:
    스켈레톤·오류에는 판정 줄 자체가 없어 날짜를 맡길 수 없다.
  */
  it('판정 데이터가 실제로 왔을 때만 날짜를 판정에 넘긴다', () => {
    expect(HOME).toContain('walkSafety.data !== undefined')
  })
})

/*
  **죽은 기준 장소** (#530). `localStorage` 의 id 가 가리키는 장소가 사라지면 조회는
  영원히 404 이고, 404 에는 재시도 버튼이 없어(`api-integration-guide.md` §3) 사용자가
  빠져나갈 길이 화면에 없었다.
*/
describe('홈 기준 장소 — 404 복구 (#530)', () => {
  it('404 면 저장된 id 를 지우고 화면 상태도 되돌린다', () => {
    expect(HOME).toContain('isBasisPlaceGone(walkSafety.error)')
    expect(HOME).toContain('clearRecentPlaceId()')
    expect(HOME).toContain('setRecentPlaceId(null)')
  })

  /*
    **렌더에서도 같이 끊는다.** effect 만 두면 저장소를 비우기 전 한 프레임 동안
    `ErrorState` 가 번쩍인다 — 지워질 것이 정해진 오류를 한 번 보여 주는 셈이다.
  */
  it('기준 id 가 렌더 시점에 이미 끊긴다', () => {
    expect(HOME).toContain('const basisPlaceId = basisGone ? null : storedBasisPlaceId')
  })
})

/*
  **목록과 머리말 사이 1px 선** (#530). 카드 제목 · 부제 · 공통 근거가 전부 같은 인셋의
  본문 글줄이라, 선이 없으면 첫 행이 바로 위 문장과 한 덩어리로 읽혔다. `SurfaceList` 는
  항목 **사이에만** 선을 긋고 첫 항목 위는 카드의 몫이다 (`components/surface.tsx`).
*/
describe('홈 적합도 목록 — 첫 행 위 구분선 (#530)', () => {
  it('행을 감싼 쪽이 위 1px 선을 그린다', () => {
    expect(HOME).toContain("cn('border-border border-t', refetching && 'opacity-55')")
  })

  /*
    **스켈레톤 · 오류 · 빈 상태에는 붙지 않는다.** 그 셋은 행이 아니라 카드가 통째로 하는
    말이라, 위에 선을 그으면 머리말에서 떨어져 나온다.
  */
  it('상태 화면에는 선을 두르지 않는다', () => {
    const emptyState = HOME.indexOf('<EmptyState')
    const before = HOME.slice(Math.max(0, emptyState - 200), emptyState)

    expect(before).not.toContain('border-t')
  })
})
