import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import type { PlaceCongestionPanelProps } from '@/features/place/place-congestion-panel'
import type { PlaceDetailActions } from '@/features/place/place-detail-action-bar'
import {
  PlaceDetailSection,
  type PlaceDetailSectionProps,
} from '@/features/place/place-detail-section'
import type { PlaceSuitabilityPanelProps } from '@/features/place/place-suitability-panel'
import { VERDICT_ANCHOR } from '@/features/place/place-verdict-summary-lines'
import type { PlaceWalkSafetyPanelProps } from '@/features/place/place-walk-safety-panel'
import { CONGESTION_DEFAULT_DAYS } from '@/lib/insight/congestion'
import { messages } from '@/lib/messages'
import {
  congestion as congestionFixture,
  suitability as suitabilityFixture,
  walkSafety as walkSafetyFixture,
} from '@/test/fixtures/insight'
import { placeDetail } from '@/test/fixtures/place'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 판정 요약 3줄 — 자리와 앵커 (#650 · 진단 D-1).
 *
 * **`PlaceDetailSection` 을 통째로 렌더한다.** 요약만 따로 렌더하면 앵커가 가리키는
 * **대상이 실재하는지**를 잴 수 없다 — 이 테스트의 핵심이 그것이다.
 *
 * 정본: `docs/features/place/장소상세-판정요약-세부명세.md` D7.
 */

const suitability: PlaceSuitabilityPanelProps = {
  data: suitabilityFixture,
  loading: false,
  failed: false,
  onRetry: () => undefined,
  petName: '몽실이',
  authed: true,
}

const walkSafety: PlaceWalkSafetyPanelProps = {
  data: walkSafetyFixture,
  loading: false,
  failed: false,
  onRetry: () => undefined,
  petName: '몽실이',
}

const congestion: PlaceCongestionPanelProps = {
  data: congestionFixture,
  loading: false,
  failed: false,
  onRetry: () => undefined,
  days: CONGESTION_DEFAULT_DAYS,
  onDaysChange: () => undefined,
}

const actions: PlaceDetailActions = {
  authed: true,
  saved: false,
  savePending: false,
  saveError: null,
  onToggleSave: () => undefined,
  added: false,
  onAddToPlan: () => undefined,
  onLogin: () => undefined,
  delisted: false,
}

function render(overrides: Partial<PlaceDetailSectionProps> = {}) {
  const props: PlaceDetailSectionProps = {
    place: placeDetail,
    loading: false,
    errorStatus: null,
    onRetry: () => undefined,
    suitability,
    walkSafety,
    congestion,
    petName: '몽실이',
    petSizeCode: 'SMALL',
    petSizeName: '소형견',
    actions,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlaceDetailSection, props))
}

const markup = render()

describe('판정 요약 3줄 — 앵커', () => {
  it('세 줄이 각자의 섹션 id 를 가리킨다', () => {
    for (const id of Object.values(VERDICT_ANCHOR)) {
      expect(markup).toContain(`href="#${id}"`)
    }
  })

  /*
    **이 단언이 이 파일의 이유다.** 요약만 따로 렌더하면 `href="#place-pet-info-heading"`
    가 있다는 것까지만 알 수 있다. 섹션 쪽 `id` 를 지우거나 이름을 바꾸면 링크는 그대로
    남고 **누르면 아무 데도 가지 않는다** — 화면은 멀쩡해 보이고 테스트도 통과한다.
  */
  it('가리키는 id 가 실제로 문서에 있다 — 갈 곳 없는 링크를 막는다', () => {
    for (const id of Object.values(VERDICT_ANCHOR)) {
      expect(markup).toContain(`id="${id}"`)
    }
  })

  /*
    헤더가 `sticky top-0 h-14` 라 여백이 없으면 뛴 제목이 헤더 뒤로 들어간다.
    `Surface` 는 `titleId` 가 있을 때 스스로 붙이고(#650), 산책 라벨은 직접 붙인다.
  */
  it('앵커 대상에 scroll-mt 가 있다', () => {
    const anchored = [...markup.matchAll(/<[^>]*id="([^"]+)"[^>]*>/g)].filter(([tag]) =>
      tag.includes('scroll-mt-20'),
    )
    const ids = anchored.map(([, id]) => id)

    for (const id of Object.values(VERDICT_ANCHOR)) {
      expect(ids).toContain(id)
    }
  })
})

describe('판정 요약 3줄 — 자리', () => {
  /*
    진단 D-1 의 성공 기준은 "390px 스크롤 0 에서 세 답이 모두 보인다" 다. 문자열 순서는
    픽셀을 재지 못하지만 **요약이 이름 뒤 · 혼잡도 앞이라는 것**은 잠글 수 있다. 픽셀은
    브라우저 실측으로 따로 잰다 (세부명세 D7).
  */
  it('이름(h1) 뒤, 혼잡도 카드 앞에 온다', () => {
    const title = markup.indexOf(placeDetail.title)
    const summary = markup.indexOf(`href="#${VERDICT_ANCHOR.pet}"`)
    const congestionCard = markup.indexOf(messages.place.detailCongestionTitle)

    expect(title).toBeGreaterThan(-1)
    expect(summary).toBeGreaterThan(title)
    expect(congestionCard).toBeGreaterThan(summary)
  })

  /*
    ≥1024 는 좌측 레일이 적합도·산책을 이미 첫 화면에 세우고 혼잡도는 본문 맨 위에 있다.
    요약을 거기서도 그리면 **같은 답이 한 화면에 두 번** 선다.
  */
  it('데스크톱에서는 그리지 않는다 — 요약 래퍼가 lg:hidden 이다', () => {
    /*
      **소스 문자열이 아니라 마크업에서 잰다** (`testing-guide.md` §5 — 소스 단언은 렌더할
      수 없는 계약에만). 파일 어딘가에 `lg:hidden` 이 있는지를 물으면 그 클래스가 셰브론으로
      옮겨가도 통과한다. 물어야 할 것은 **목록을 감싼 그 요소**가 감춰지는가다.
    */
    const wrapper = markup.match(/<div class="([^"]*)"><ul[^>]*aria-label="이 장소 한눈에 보기"/)

    expect(wrapper).not.toBeNull()
    expect(wrapper?.[1]).toContain('lg:hidden')
  })

  /*
    44px — 모바일 최소 터치 영역 (DESIGN.md §7).

    **`markup` 전체에서 `min-h-11` 을 찾으면 안 된다** — 같은 문서의 `TelLink`·
    `HomepageLink` 가 이미 그 클래스를 내고 픽스처에 `tel`·`homepage` 가 둘 다 있어,
    요약 줄에서 통째로 지워도 통과한다. 요약 줄의 **여는 태그 안**에서 찾는다.
  */
  it('줄 높이가 44px 이상이다', () => {
    for (const id of Object.values(VERDICT_ANCHOR)) {
      const openTag = markup.match(new RegExp(`<a href="#${id}"[^>]*>`))?.[0]

      expect(openTag).toBeDefined()
      expect(openTag).toContain('min-h-11')
    }
  })
})

describe('판정 요약 3줄 — 읽히는 말', () => {
  it('라벨과 값이 같은 링크 안에 있다 — 값만 읽히지 않는다', () => {
    const row = markup.match(new RegExp(`<a href="#${VERDICT_ANCHOR.walk}"[\\s\\S]*?</a>`))?.[0]

    expect(row).toBeDefined()
    expect(row).toContain(messages.place.detailSummaryWalkLabel)
    expect(row).toContain(walkSafetyFixture.walkSafetyLevel.name)
  })

  it('블록에 이름을 준다 — h2 를 새로 만들지 않는다', () => {
    expect(markup).toContain(`aria-label="${messages.place.detailSummaryLabel}"`)
  })

  /*
    판정 둘이 다 죽어도 동반 줄은 남는다. 요약 블록이 통째로 비면 구분선만 허공에 뜬다.
  */
  it('판정 둘 다 실패해도 동반 줄과 블록이 남는다', () => {
    const broken = render({
      walkSafety: { ...walkSafety, data: null, failed: true },
      congestion: { ...congestion, data: null, failed: true },
    })

    expect(broken).toContain(`href="#${VERDICT_ANCHOR.pet}"`)
    expect(broken).not.toContain(`href="#${VERDICT_ANCHOR.walk}"`)
    expect(broken).not.toContain(`href="#${VERDICT_ANCHOR.congestion}"`)
  })
})

describe('판정 요약 3줄 — 갤러리 높이', () => {
  /* 요약이 첫 화면 예산을 먹으므로 갤러리를 200 으로 줄였다 (진단 D-1) */
  it('모바일 갤러리 토큰이 200 이다', () => {
    const tokens = readSourceWithoutComments('src/styles/tokens.css')

    expect(tokens).toContain('--gallery-h-mobile: 200px')
  })
})
