import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceMapPreviewBody,
  type PlaceMapPreviewBodyProps,
} from '@/features/place/place-map-preview-body'
import { messages } from '@/lib/messages'
import { suitability, walkSafety } from '@/test/fixtures/insight'
import { placeDetail, placeDetailDelisted, placeSummary } from '@/test/fixtures/place'

const ok = <T>(data: T) => ({ data, loading: false, failed: false })
const pending = { data: null, loading: true, failed: false }
const failed = { data: null, loading: false, failed: true }

const base: PlaceMapPreviewBodyProps = {
  placeId: placeSummary.placeId,
  variant: 'panel',
  onClose: () => undefined,
  summary: placeSummary,
  detail: ok(placeDetail),
  suitability: ok(suitability),
  walkSafety: ok(walkSafety),
  petName: '몽실이',
  actions: {
    authed: true,
    saved: false,
    savePending: false,
    saveError: null,
    onToggleSave: () => undefined,
    added: false,
    onAddToPlan: () => undefined,
    onLogin: () => undefined,
    delisted: false,
  },
}

function render(over: Partial<PlaceMapPreviewBodyProps> = {}) {
  return renderToStaticMarkup(createElement(PlaceMapPreviewBody, { ...base, ...over }))
}

describe('PlaceMapPreviewBody — 두 겹으로 그린다 (목록 행 즉시 · 상세 뒤)', () => {
  it('상세를 기다리는 동안에도 목록 행으로 이름을 그린다 — 핵심 줄은 아직 없다', () => {
    const html = render({ detail: pending })

    expect(html).toContain(placeSummary.title)
    expect(html).not.toContain(messages.map.directions)
    expect(html).toContain(messages.plan.addToPlanAction)
  })

  it('목록에 없고 상세도 대기면 골격뿐 — 하단 바가 없다', () => {
    const html = render({ summary: null, detail: pending })

    expect(html).not.toContain('<h2')
    expect(html).not.toContain(messages.plan.addToPlanAction)
  })

  it('목록에 없으면 상세 응답으로 그린다', () => {
    const html = render({ summary: null })

    expect(html).toContain(placeDetail.title)
  })

  it('목록에도 없고 상세도 실패면 문구와 상세 보기 · 닫기만 — 재시도도 하단 바도 없다', () => {
    const html = render({ summary: null, detail: failed })

    expect(html).toContain(messages.map.previewLoadFailed)
    expect(html).toContain(messages.map.previewDetail)
    expect(html).toContain(messages.map.previewClose)
    expect(html).not.toContain(messages.common.retry)
    expect(html).not.toContain(messages.plan.addToPlanAction)
  })
})

describe('PlaceMapPreviewBody — 판정 줄', () => {
  it('반려견이 있으면 그 이름으로 적합도 근거 첫 줄을 단다', () => {
    const html = render()

    expect(html).toContain('몽실이')
    expect(html).toContain(suitability.reasons[0]?.description ?? '')
  })

  it('반려견이 없으면 근거 줄이 없고 등급은 이름 옆 배지만 — 상세와 같다', () => {
    const html = render({ petName: null })

    expect(html).not.toContain(suitability.reasons[0]?.description ?? '')
    expect(html).toContain(suitability.suitabilityLevel.name)
  })

  it('적합도가 실패하면 그 줄만 빠지고 동반 · 산책은 남는다', () => {
    const html = render({ suitability: failed })

    expect(html).not.toContain('몽실이')
    expect(html).toContain(messages.place.detailSummaryPetLabel)
    expect(html).toContain(messages.place.detailSummaryWalkLabel)
  })

  it('산책이 실패하면 산책 줄만 빠진다', () => {
    const html = render({ walkSafety: failed })

    expect(html).not.toContain(messages.place.detailSummaryWalkLabel)
    expect(html).toContain(messages.place.detailSummaryPetLabel)
  })

  it('혼잡도 줄은 어느 갈래에서도 서지 않는다 — 상세의 몫이다', () => {
    expect(render()).not.toContain(messages.place.detailSummaryCongestionLabel)
  })
})

describe('PlaceMapPreviewBody — 폭 갈래', () => {
  it('패널은 `‹ 목록`(xl 에서 숨김)을 갖는다', () => {
    const html = render({ variant: 'panel' })

    expect(html).toContain(messages.map.previewBackToList)
    expect(html).toContain('xl:hidden')
  })

  it('시트는 `‹ 목록` 이 없다 — 닫으면 목록 시트가 돌아온다', () => {
    expect(render({ variant: 'sheet' })).not.toContain(messages.map.previewBackToList)
  })
})

describe('PlaceMapPreviewBody — 하단 바와 접근성', () => {
  it('미로그인은 상세 하단 바처럼 `로그인` 이 선다', () => {
    expect(render({ actions: { ...base.actions, authed: false } })).toContain(
      messages.plan.addToPlanLoginAction,
    )
  })

  it('사라진 장소는 잠금 문구가 선다', () => {
    const html = render({
      detail: ok(placeDetailDelisted),
      actions: { ...base.actions, delisted: true },
    })

    expect(html).toContain(messages.place.detailDelistedActionsBlocked)
  })

  it('section 이름 · 닫기 이름 · 상세 링크(보이는 글자 포함)를 갖는다', () => {
    const html = render()

    expect(html).toContain(`aria-label="${messages.map.previewLabel}"`)
    expect(html).toContain(`aria-label="${messages.map.previewClose}"`)
    expect(html).toContain(`href="/places/${placeSummary.placeId}"`)
    expect(html).toContain(messages.map.previewDetail)
  })

  it('하단 바가 잘리지 않게 section 에 `min-h-0` · 바에 `shrink-0` 이 있다', () => {
    const html = render()

    expect(html).toMatch(/<section[^>]*class="[^"]*min-h-0/)
    expect(html).toContain('shrink-0')
  })

  it('긴 이름이 넘치지 않는다 — `min-w-0 break-words`', () => {
    expect(render()).toMatch(/<h2[^>]*class="[^"]*min-w-0[^"]*break-words/)
  })
})

/*
  #1230 — 사용자 지적 네 가지: 로딩이 빈칸으로 보인다 · 상세 보기가 닫기 옆이다 · 사진이 한 장뿐이다 ·
  정보가 너무 간략하다.
*/
describe('PlaceMapPreviewBody — 로딩 표시 (#1230)', () => {
  it('판정 줄 상자는 골격과 같은 `--band` 로 칠하지 않는다 — 골격이 묻혀 빈칸으로 보였다', () => {
    const html = render({ suitability: pending, walkSafety: pending })
    const box = /<dl aria-busy="true" class="([^"]*)"/.exec(html)

    expect(box?.[1]).toBeDefined()
    expect(box?.[1]).not.toContain('bg-band')
    expect(html).toContain('animate-pulse')
    expect(html).toContain(messages.map.previewLoading)
  })

  it('라벨은 먼저 선다 — 무엇을 기다리는지 보인다', () => {
    const html = render({ walkSafety: pending })

    expect(html).toContain(messages.place.detailSummaryWalkLabel)
  })

  it('상세를 기다리는 동안에도 동반 · 지금 산책 라벨과 골격이 선다', () => {
    const html = render({ detail: pending, walkSafety: pending })

    expect(html).toContain(messages.place.detailSummaryPetLabel)
    expect(html).toContain(messages.place.detailSummaryWalkLabel)
    expect(html).toContain('aria-busy="true"')
  })

  it('적합도를 묻는 동안 이름 옆에 배지 모양 골격이 자리를 잡는다', () => {
    const html = render({ suitability: pending })
    const head = html.slice(html.indexOf('<h2'), html.indexOf('</h2>') + 400)

    expect(head).toContain('animate-pulse')
    expect(head).not.toContain(suitability.suitabilityLevel.name)
  })

  it('다 받으면 aria-busy 가 거짓이다', () => {
    expect(render()).toContain('aria-busy="false"')
  })
})

describe('PlaceMapPreviewBody — 상세로 가는 길은 정보 맨 아래다 (#1230)', () => {
  it('닫기 옆(머리 줄)에 없고, 이용 안내 뒤 · 하단 바 앞에 선다', () => {
    const html = render()
    const link = html.indexOf(messages.map.previewDetail)

    expect(link).toBeGreaterThan(html.indexOf(messages.place.detailSectionIntro))
    expect(link).toBeLessThan(html.indexOf(messages.plan.addToPlanAction))
    expect(link).toBeGreaterThan(html.indexOf(`aria-label="${messages.map.previewClose}"`))
  })
})

describe('PlaceMapPreviewBody — 사진은 상세와 같은 목록 (#1230)', () => {
  const twoImages = {
    ...placeDetail,
    images: [
      ...placeDetail.images,
      {
        originImgUrl: 'http://tong.visitkorea.or.kr/cms/resource/mock/place-2.jpg',
        smallImageUrl: null,
        imgName: '두 번째',
        cpyrhtDivCd: 'Type1',
      },
    ],
  }

  it('상세 응답의 이미지 목록을 캐러셀로 그린다 — 장수 카운터가 선다', () => {
    const html = render({ detail: ok(twoImages) })

    expect(html).toContain('1/2')
    // 모자이크(데스크톱 갈래)를 그리지 않는다 — 400 폭 패널이다
    expect(html).not.toContain('hidden md:block')
  })
})

describe('PlaceMapPreviewBody — 이용 안내 (#1230)', () => {
  it('휴무일 · 주차 · 유모차 · 카드 · 전체 주소를 싣는다', () => {
    const html = render()

    expect(html).toContain(messages.place.detailSectionIntro)
    expect(html).toContain(placeDetail.intro?.restDate ?? '')
    expect(html).toContain(`${placeDetail.addr1} ${placeDetail.addr2}`)
  })

  it('운영시간이 한 줄이면 이용 안내에서 빠진다 — 핵심 줄이 이미 같은 문장을 말한다', () => {
    const intro = placeDetail.intro
    if (intro === null) throw new Error('fixture 에 intro 가 있어야 한다')
    const oneLine = { ...placeDetail, intro: { ...intro, useTime: '상시 개방' } }
    const html = render({ detail: ok(oneLine) })

    expect(html.match(/상시 개방/g)).toHaveLength(1)
    expect(html).not.toContain(`>${messages.place.detailUseTime}<`)
  })

  it('여러 줄이면 전문을 싣는다 — 핵심 줄은 첫 줄뿐이다', () => {
    const intro = placeDetail.intro
    if (intro === null) throw new Error('fixture 에 intro 가 있어야 한다')
    const multi = {
      ...placeDetail,
      intro: { ...intro, useTime: '09:00~18:00<br>(입장 마감 17:00)' },
    }

    expect(render({ detail: ok(multi) })).toContain('(입장 마감 17:00)')
  })

  it('값이 하나도 없으면 절이 없다', () => {
    const bare = { ...placeDetail, intro: null, addr1: null, addr2: null }

    expect(render({ detail: ok(bare) })).not.toContain(messages.place.detailSectionIntro)
  })
})
