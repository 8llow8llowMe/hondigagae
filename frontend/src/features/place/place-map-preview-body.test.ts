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
import type { PlaceSuitabilityResponse, WalkSafetyResponse } from '@/types/insight'
import type { PlaceDetail } from '@/types/place'

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
    delisted: false,
    onShare: () => undefined,
    onCopyAddress: () => undefined,
  },
}

function render(over: Partial<PlaceMapPreviewBodyProps> = {}) {
  return renderToStaticMarkup(createElement(PlaceMapPreviewBody, { ...base, ...over }))
}

/** 결론과 근거가 엇갈리지 않는 날 — 맑음 · 산책 안전 · 붐빔(주의 하나) */
const goodDay: PlaceSuitabilityResponse = {
  ...suitability,
  weather: suitability.weather && {
    ...suitability.weather,
    maxTemperature: 23,
    maxPrecipitationProbability: 0,
    precipitationType: { code: 'NONE', name: '없음', description: null },
    skyState: { code: 'CLEAR', name: '맑음', description: null },
  },
  congestion: { level: { code: 'HIGH', name: '붐빔', description: null }, concentrationRate: 81 },
}
const safeWalk: WalkSafetyResponse = {
  ...walkSafety,
  walkSafetyLevel: { code: 'SAFE', name: '안전', description: null, scoreDescription: null },
  saferWindowStart: null,
  saferWindowEnd: null,
}

function withIntro(over: Partial<NonNullable<PlaceDetail['intro']>>): PlaceDetail {
  const intro = placeDetail.intro
  if (intro === null) throw new Error('fixture 에 intro 가 있어야 한다')
  return { ...placeDetail, intro: { ...intro, ...over } }
}

/** 판정 카드(⑤)만 떼어 본다 — 머리 문구부터 그 `section` 이 닫힐 때까지 */
function verdictCard(html: string) {
  const start = html.lastIndexOf(
    '<section',
    html.indexOf(messages.map.previewVerdictHead.slice(0, 2)),
  )
  return html.slice(start, html.indexOf('</section>', start))
}

describe('PlaceMapPreviewBody — 두 겹으로 그린다 (목록 행 즉시 · 상세 뒤)', () => {
  it('상세를 기다리는 동안에도 목록 행으로 이름 · 행동 줄 · 담기가 선다', () => {
    const html = render({ detail: pending })

    expect(html).toContain(placeSummary.title)
    expect(html).toContain(messages.map.previewActionsLabel)
    expect(html).toContain(messages.plan.addToPlanAction)
  })

  it('목록에 없고 상세도 대기면 골격뿐 — 하단 바가 없다', () => {
    const html = render({ summary: null, detail: pending })

    expect(html).not.toContain('<h2')
    expect(html).not.toContain(messages.plan.addToPlanAction)
  })

  it('목록에 없으면 상세 응답으로 그린다', () => {
    expect(render({ summary: null })).toContain(placeDetail.title)
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

describe('PlaceMapPreviewBody — ① 이름 · ② 상태 줄 · ③ 칩 (#1233)', () => {
  it('이름 옆에 적합도 배지가 없다 — 등급은 판정 카드에서 한 번만 말한다', () => {
    const html = render()
    const head = html.slice(html.indexOf('<h2'), html.indexOf(messages.map.previewActionsLabel))

    expect(head).not.toContain(suitability.suitabilityLevel.name)
    expect(html.split(suitability.suitabilityLevel.name)).toHaveLength(2)
  })

  it('이름 옆에 분류를 작게 둔다 — 이름(h2) 밖이다', () => {
    expect(render()).toMatch(
      new RegExp(
        `</h2><span class="[^"]*text-fg-muted[^"]*">${placeDetail.contentType.name}</span>`,
      ),
    )
  })

  it('영업 중이면 상태 줄 맨 앞에 점 + 영업 중 — 영업 상태 색이다(등급 색이 아니다)', () => {
    expect(render()).toMatch(
      new RegExp(
        `<span class="text-status-open-700 font-semibold"><span aria-hidden="true">● </span>${messages.place.detailOpenNow}</span> · 제주시 한림읍`,
      ),
    )
  })

  it('운영 원문이 없으면 상태가 빠지고 주소만 선다 — 근거 없는 판정을 세우지 않는다', () => {
    const html = render({ detail: ok(withIntro({ useTime: null })) })

    expect(html).not.toContain(messages.place.detailOpenNow)
    expect(html).toContain('제주시 한림읍')
  })

  it('방문 핵심 줄(번호 · 길찾기 글줄 링크)을 쓰지 않는다 — 번호는 전화 칸의 이름에만 있다', () => {
    const html = render()

    expect(html.split(placeDetail.tel ?? '')).toHaveLength(2)
    expect(html).toContain(`<span class="sr-only"> ${placeDetail.tel}</span>`)
  })

  it('동반 칩은 허용 크기까지, 실내 칩은 낱말 하나 — 판정은 칩이 아니다', () => {
    const html = render()

    expect(html).toContain('부분 동반 가능 · 전 견종 가능')
    expect(html).toContain(`>${messages.place.rowIndoor}</span>`)
  })

  it('실내 여부를 모르면 점선으로 드러낸다', () => {
    expect(render({ detail: ok({ ...placeDetail, indoor: null }) })).toContain(
      messages.place.rowIndoorUnknown,
    )
  })
})

describe('PlaceMapPreviewBody — ④ 행동 줄', () => {
  it('길찾기 · 전화 · 저장 · 공유 4칸이 같은 폭으로 선다', () => {
    const html = render()
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))

    expect(nav).toContain(`aria-label="${messages.map.previewActionsLabel}"`)
    expect(nav).toContain('grid-cols-4')
    expect(nav.match(/<li>/g)).toHaveLength(4)
    for (const word of [
      messages.map.directions,
      messages.map.previewCall,
      messages.map.previewSave,
      messages.map.previewShare,
    ]) {
      expect(nav).toContain(word)
    }
  })

  it('좌표 · 번호가 없으면 칸은 남고 흐려진다 — 이유는 스크린리더에', () => {
    const html = render({
      summary: { ...placeSummary, lat: null, lng: null, tel: null },
      detail: ok({ ...placeDetail, lat: null, lng: null, tel: null }),
    })
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))

    expect(nav.match(/<li>/g)).toHaveLength(4)
    expect(nav.match(/aria-disabled="true"/g)).toHaveLength(2)
    expect(nav).toContain(messages.map.previewDirectionsUnavailable)
    expect(nav).toContain(messages.map.previewCallUnavailable)
    expect(nav).not.toContain('tel:')
  })

  it('저장되면 채운 아이콘 + 저장됨, 눌린 상태를 aria-pressed 로 말한다', () => {
    const html = render({ actions: { ...base.actions, saved: true } })

    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain(messages.map.previewSaved)
  })

  it('미로그인은 저장 여부를 모른다 — 눌린 상태를 말하지 않는다', () => {
    const html = render({ actions: { ...base.actions, authed: false, saved: true } })

    expect(html).not.toContain('aria-pressed')
    expect(html).not.toContain(messages.map.previewSaved)
  })
})

describe('PlaceMapPreviewBody — ⑤ 오늘 판정 카드', () => {
  it('머리는 반려견 이름 + 조사다', () => {
    expect(render()).toContain('오늘 몽실이와')
    expect(render({ petName: '몽' })).toContain('오늘 몽과')
  })

  it('headline 이 없으면 등급명을 결론 자리에 크게 쓰고 배지는 생략한다', () => {
    const card = verdictCard(render())

    expect(card).toContain(`text-title-2`)
    expect(card).toMatch(
      new RegExp(`<p class="[^"]*text-title-2[^"]*">${suitability.suitabilityLevel.name}</p>`),
    )
    expect(card.split(suitability.suitabilityLevel.name)).toHaveLength(2)
  })

  it('headline 이 오면 그것이 결론이고 등급은 그 아래 작은 배지다', () => {
    const card = verdictCard(
      render({ suitability: ok({ ...suitability, headline: '오늘 가기 좋아요' }) }),
    )

    expect(card).toMatch(/<p class="[^"]*text-title-2[^"]*">오늘 가기 좋아요<\/p>/)
    expect(card).toContain(`>${suitability.suitabilityLevel.name}</span>`)
  })

  it('좋은 쪽 사실이 먼저 — 결론 바로 아래 주의 사실이 오지 않는다', () => {
    const card = verdictCard(render({ suitability: ok(goodDay), walkSafety: ok(safeWalk) }))

    expect(card.indexOf('지금 산책 안전')).toBeGreaterThan(-1)
    expect(card.indexOf('지금 산책 안전')).toBeLessThan(card.indexOf('붐빔 · 집중률 81%'))
    expect(card).toContain(`<span class="sr-only">${messages.map.previewFactCaution} </span>붐빔`)
  })

  it('근거 문장(reasons)을 싣지 않는다 — 상세의 몫이다', () => {
    const html = render()

    expect(html).not.toContain(suitability.reasons[0]?.description ?? '')
    expect(html).not.toContain(walkSafety.reasons[0]?.description ?? '')
  })

  it('반려견이 없으면 `오늘 이 장소` + 등록 안내, 근거 사실은 그대로', () => {
    const html = render({ petName: null })

    expect(html).toContain(messages.map.previewVerdictHeadNoPet)
    expect(html).toContain(messages.map.previewPetPrompt)
    expect(html).toContain('href="/pets/new"')
    expect(html).toContain('지금 산책')
  })

  it('판정을 묻는 동안 카드 모양 골격 — 카드(`--band`) 위라 골격은 `--bg` 다', () => {
    const card = verdictCard(render({ suitability: pending, walkSafety: pending }))

    expect(card).toContain('aria-busy="true"')
    expect(card).toContain('bg-band')
    expect(card).toContain('bg-bg animate-pulse')
    expect(card).not.toContain('bg-band animate-pulse')
    expect(card).toContain(messages.map.previewLoading)
  })

  it('판정 하나가 실패하면 그 사실만 빠진다', () => {
    const card = verdictCard(render({ walkSafety: failed }))

    expect(card).not.toContain('지금 산책')
    expect(card).toContain(suitability.suitabilityLevel.name)
  })

  it('둘 다 실패면 카드가 없다', () => {
    expect(render({ suitability: failed, walkSafety: failed })).not.toContain('오늘 몽실이와')
  })
})

describe('PlaceMapPreviewBody — ⑥ 이용 정보 (아이콘 행)', () => {
  it('라벨 칸(dl/dt) 없이 아이콘 + 값으로 선다', () => {
    const html = render()

    expect(html).toContain(messages.map.previewUseInfo)
    expect(html).not.toContain('<dt')
    expect(html).toContain(`휴무 ${placeDetail.intro?.restDate ?? ''}`)
    expect(html).toContain(`${placeDetail.addr1} ${placeDetail.addr2}`)
    expect(html).toContain(`aria-label="${messages.map.previewAddressCopyLabel}"`)
  })

  it('운영시간이 여러 줄이면 행을 눌러 펼친다 — 전문은 접힌 채 문서에 있다', () => {
    const html = render({ detail: ok(withIntro({ useTime: '09:00~18:00<br>(입장 마감 17:00)' })) })

    expect(html).toMatch(/aria-expanded="false" aria-controls="[^"]+"/)
    expect(html).toMatch(/hidden=""[^>]*>09:00~18:00\n\(입장 마감 17:00\)/)
  })

  it('유모차 · 카드는 더보기 안에 접혀 있다 — 문의처가 전화와 같으면 싣지 않는다', () => {
    const html = render()
    const more = html.slice(html.indexOf(messages.map.previewMore))

    expect(more).toContain(placeDetail.intro?.chkBabyCarriage ?? '')
    expect(more).toMatch(/<ul id="[^"]+" hidden=""/)
    expect(more).not.toContain(messages.place.detailInfoCenter)
  })

  it('값이 하나도 없으면 절이 없다', () => {
    const bare = { ...placeDetail, intro: null, addr1: null, addr2: null }

    expect(render({ detail: ok(bare) })).not.toContain(messages.map.previewUseInfo)
  })
})

describe('PlaceMapPreviewBody — ⑦ 상세 보기 · ⑧ 하단 바', () => {
  it('하단 바는 담기 하나 — 상세 하단 바의 저장 아이콘 · 로그인 버튼이 없다', () => {
    const html = render({ actions: { ...base.actions, authed: false } })
    const bar = html.slice(html.lastIndexOf('border-t'))

    expect(bar.match(/<button/g)).toHaveLength(1)
    expect(bar).toContain(messages.plan.addToPlanAction)
    expect(html).not.toContain(messages.plan.addToPlanLoginAction)
  })

  it('사라진 장소는 담기를 잠그고 이유를 버튼 위에, 저장 칸도 잠근다', () => {
    const html = render({
      detail: ok(placeDetailDelisted),
      actions: { ...base.actions, delisted: true },
    })

    expect(html).toContain(messages.place.detailDelistedActionsBlocked)
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>[^<]*일정에 담기/)
    expect(html).toContain(messages.map.previewSaveBlocked)
  })

  it('사라진 장소여도 저장 해제는 열려 있다', () => {
    const html = render({
      detail: ok(placeDetailDelisted),
      actions: { ...base.actions, delisted: true, saved: true },
    })

    expect(html).not.toContain(messages.map.previewSaveBlocked)
    expect(html).toContain('aria-pressed="true"')
  })

  it('담은 뒤에는 라벨이 바뀐다 — 같은 자리에서 중복으로 담지 않게', () => {
    expect(render({ actions: { ...base.actions, added: true } })).toContain(
      messages.plan.addToPlanAgainAction,
    )
  })

  it('상세 링크는 장소명을 이름에 품고, 이용 정보 뒤 · 하단 바 앞에 선다', () => {
    const html = render()
    const link = html.indexOf(messages.map.previewDetail)

    expect(html).toContain(
      `<span class="sr-only">${placeSummary.title} </span>${messages.map.previewDetail}`,
    )
    expect(link).toBeGreaterThan(html.indexOf(messages.map.previewUseInfo))
    expect(link).toBeLessThan(html.indexOf(messages.plan.addToPlanAction))
  })
})

describe('PlaceMapPreviewBody — 폭 갈래 · 틀', () => {
  it('패널은 `‹ 목록`(xl 에서 숨김)을 갖는다', () => {
    const html = render({ variant: 'panel' })

    expect(html).toContain(messages.map.previewBackToList)
    expect(html).toContain('xl:hidden')
  })

  it('시트는 `‹ 목록` 이 없다 — 닫으면 목록 시트가 돌아온다', () => {
    expect(render({ variant: 'sheet' })).not.toContain(messages.map.previewBackToList)
  })

  it('section 이름 · 닫기 이름을 갖는다', () => {
    const html = render()

    expect(html).toContain(`aria-label="${messages.map.previewLabel}"`)
    expect(html).toContain(`aria-label="${messages.map.previewClose}"`)
    expect(html).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('하단 바가 잘리지 않게 section 에 `min-h-0` · 바에 `shrink-0` 이 있다', () => {
    const html = render()

    expect(html).toMatch(/<section[^>]*class="[^"]*min-h-0/)
    expect(html).toContain('shrink-0 border-t')
  })

  it('긴 이름이 넘치지 않는다 — `min-w-0 break-words`', () => {
    expect(render()).toMatch(/<h2[^>]*class="[^"]*min-w-0[^"]*break-words/)
  })

  it('상세 응답의 이미지 목록을 캐러셀로 그린다 — 장수 카운터가 선다', () => {
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
    const html = render({ detail: ok(twoImages) })

    expect(html).toContain('1/2')
    expect(html).not.toContain('hidden md:block')
  })
})
