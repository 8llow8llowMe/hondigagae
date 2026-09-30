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
    날짜를 넘겼다. 이제 `WalkVerdict` 가 두 폭 모두 자기 자리에 그리므로, 카드 맨 위
    자리는 **판정 자리가 없을 때만** 선다 — 폭이 아니라 상태가 가른다.
  */
  it('날짜 자리를 폭으로 가르지 않는다', () => {
    expect(HOME).not.toContain("verdictShown && 'md:hidden'")
    expect(HOME).toContain('{!verdictSlotShown && (')
  })
})

/*
  **로딩 화면과 완료 화면의 날짜가 같은 자리다.** 예전에는 판정 **데이터**가 와야
  날짜가 판정으로 넘어가서(`walkSafety.data !== undefined`), 대기 중에는 카드 맨 위
  (프로필 위)에 섰다가 판정이 오는 순간 프로필 아래로 내려앉았다. 이제 판정 자리가 서는
  세 갈래(대기 · 오류 · 판정)가 모두 자기 맨 위에 날짜를 그린다.
*/
describe('홈 날짜 줄 — 대기 중에도 판정 자리 (로딩 일치)', () => {
  it('카드 맨 위 자리는 판정 자리 자체가 없을 때만이다', () => {
    expect(HOME).toContain('const verdictSlotShown = basisPlaceId !== null')
    expect(HOME).not.toContain('const verdictShown')
  })

  it('대기 골격이 날짜를 받는다 — loading.tsx 와 같은 컴포넌트다', () => {
    expect(HOME).toContain('<WalkVerdictSkeleton todayLabel={todayLabel} />')
    expect(source('app/(main)/(home)/loading.tsx')).toContain(
      '<WalkVerdictSkeleton todayLabel={null} />',
    )
  })

  it('오류 갈래도 판정 자리 맨 위에 날짜를 그린다', () => {
    const error = HOME.indexOf('{walkSafety.isError && (')
    const retry = HOME.indexOf('<ErrorState', error)

    expect(HOME.slice(error, retry)).toContain('{todayLabel}')
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
  **목록 위 1px 선을 걷었다** (#1069). #530 은 행 목록의 첫 행이 바로 위 글줄과 한 덩어리로
  읽혀 선을 그었는데, 카드의 첫 항목은 **사진 면**이라 머리말과 저절로 갈린다. 선을 남기면
  사진 위에 가로줄이 하나 더 서서 카드 경계가 두 겹이 된다.
*/
describe('홈 추천 카드 — 목록 위 구분선 (#1069)', () => {
  it('카드 틀을 선으로 감싸지 않는다', () => {
    const list = HOME.indexOf('<PlaceInsightCardList')
    const before = HOME.slice(Math.max(0, list - 1200), list)

    expect(list).toBeGreaterThan(-1)
    expect(before).not.toContain('border-t')
  })

  /* 스켈레톤 · 오류 · 빈 상태도 선이 없다 — 행이 아니라 카드가 통째로 하는 말이다 */
  it('상태 화면에는 선을 두르지 않는다', () => {
    const emptyState = HOME.indexOf('<EmptyState')
    const before = HOME.slice(Math.max(0, emptyState - 200), emptyState)

    expect(before).not.toContain('border-t')
  })

  /*
    **카드 구성이 바뀌면 틀을 새로 세운다.** 적합도 세 건이 따로 도착하면 앞쪽에 카드가
    끼어드는데, 스냅 컨테이너는 직전에 붙어 있던 항목(먼저 선 끝 카드)을 따라 다시 스냅해
    768 실측에서 첫 화면이 1위가 아니라 끝 카드였다. key 가 카드 id 들을 담아야 한다.
  */
  it('틀의 key 가 카드 구성을 담는다', () => {
    const list = HOME.slice(HOME.indexOf('<PlaceInsightCardList'))

    expect(list.slice(0, 200)).toContain('scored.map((data) => data.placeId)')
  })
})
