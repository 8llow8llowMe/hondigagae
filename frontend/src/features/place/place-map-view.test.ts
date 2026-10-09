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

/*
  #1177 — 담기 지도가 그날 직전 장소에서 연다. **기준점이 없으면 `/places` 그대로다.**

  기준점은 마운트 때 값만 쓴다 — 담기 응답이 기준점을 바꿀 때마다 카메라가 옮겨지면
  연달아 담는 흐름(#370)이 끊긴다. 상태 전이(첫 `idle` 함정)는 `place-map-area.test.ts` 가 잰다.
*/
describe('PlaceMapView — 기준점에서 열기 (#1177)', () => {
  it('기준점은 마운트 때 한 번 얼린다', () => {
    expect(code).toContain('const [focus] = useState<LatLng | null>(initialFocus ?? null)')
  })

  it('기준점이 없으면 제주 기본 영역 · 목록 캐시 · 카메라 없음이다', () => {
    expect(code).toContain('focus === null ? INITIAL_PLACE_MAP_AREA : focusedPlaceMapArea(focus)')
    expect(code).toContain('const [researched, setResearched] = useState(focus !== null)')
    expect(code).toContain('focus === null ? null : { anchor: focus,')
    expect(code).toContain("useRef<FocusFraming | null>(focus === null ? null : 'pending')")
  })

  it('기준점 지도는 주변 조회가 오기 전까지 행 골격을 둔다 — 빈 상태가 먼저 깜빡이지 않는다', () => {
    expect(code).toContain('(focus !== null && nearbyQuery.isPending)')
  })
})

/*
  **대기 골격을 품는 캡션은 `p` 가 아니다** (#1177). `Skeleton` 은 `div` 라 `p` 안에 두면 HTML 이
  허락하지 않아 하이드레이션이 깨진다 — 기준점 지도가 서버 렌더 시점에 주변 조회를 기다리며
  처음 이 갈래를 서버에서 그렸을 때 실측으로 걸렸다.
*/
describe('PlaceMapView — 개수 캡션의 요소 (#1177)', () => {
  it('골격을 품을 수 있는 캡션이 p 로 열리지 않는다', () => {
    const caption = source.indexOf(
      '{listPending ? <Skeleton className="h-4.5 w-20" /> : countLine}',
    )
    const opener = source.lastIndexOf('<', source.lastIndexOf('className=', caption))

    expect(caption).toBeGreaterThan(0)
    expect(source.slice(opener, opener + 4)).toBe('<div')
  })
})

/*
  **기준점 지도의 두 실패 갈래** (#1177 지도 검토). 하나는 SDK 폴백이 기준점을 버리던 것, 하나는
  첫 주변 조회의 일시 장애를 "이 지역에는 표시할 곳이 없어요" 로 말하던 것이다.
*/
describe('PlaceMapView — 기준점 지도의 실패 갈래 (#1177)', () => {
  /*
    #1289 — SDK 가 실패하면 축소판 목록을 그리지 않고 목록 보기로 옮긴다. 예전 이 자리는 그 축소판이 첫 장이
    아니라 기준점 주변 조회(#1177)를 그리는지를 지켰다 — 이제 그 일은 담기 목록 보기(거리순, #1217)가 한다.
  */
  it('SDK 실패는 축소판 목록 대신 목록 보기로 옮긴다', () => {
    expect(source).not.toContain('<PlaceListSection')
    expect(source).toContain('useMapFailureFallback(failure, fallbackHref)')
  })

  it('주변 조회의 일시 장애는 빈 상태가 아니라 재시도다 — 패널 · 시트 두 곳 모두', () => {
    const branches = source.match(/\) : nearbyFailed \? \(\s*nearbyErrorState/g) ?? []

    expect(branches).toHaveLength(2)
    expect(source).toMatch(/nearbyQuery\.isError && isRetriable\(nearbyQuery\.error\)/)
  })
})

/*
  #1227 — 장소 미리보기. `/places` 만 켜고(`preview`), 폭마다 자리가 갈린다
  (`docs/features/place/지도미리보기-세부명세.md` D1 · D5).
*/
describe('PlaceMapView — 장소 미리보기 (#1227)', () => {
  it('1024~1279 는 미리보기가 목록 자리를 쓴다 — 목록은 invisible (a11y · Tab 에서도 빠진다)', () => {
    // 시설 요약(#1286)도 같은 칸을 쓴다 — `docked` = 장소 미리보기 또는 시설 요약
    expect(code).toContain("docked && 'lg:max-xl:invisible'")
  })

  it('모바일 목록 시트는 언마운트하지 않고 숨긴다 — 닫으면 스크롤 · 단계가 그대로 돌아온다', () => {
    expect(code).toContain("className={cn(docked && 'hidden')}")
  })

  it('패널 · 시트 둘 다 key={previewId} 로 마운트한다 — 장소를 바꾸면 상태가 새로 시작한다', () => {
    expect(code.match(/key=\{previewId\}/g)).toHaveLength(2)
  })

  /*
    #1232 D2 — 1280 부터 목록 **바로 옆**(흐름 안, 간격 0), 그 아래는 목록 자리(`absolute left-0`).
    목록과 함께 스택 안에 있어 접으면 같이 밀려난다 — 접힌 목록 옆에 홀로 서지 않는다.
  */
  it('미리보기는 스택 안에서 1280 부터 흐름에 들고 그 아래는 목록 자리에 겹친다', () => {
    expect(code).toContain(
      'map-panel-width bg-bg border-border absolute inset-y-0 left-0 overflow-hidden border-r xl:static',
    )
  })

  it('담기 지도(미리보기 꺼짐)는 정중앙 카메라 그대로다', () => {
    expect(code).toContain('selectedOffset={preview ? selectedOffset : undefined}')
  })

  it('모바일 위 경계는 뷰포트 기준 136 이다 — root.top 에 더하지 않는다 (헤더 이중 차감)', () => {
    expect(code).toContain('Math.max(root.top, MAP_TOP_CONTROLS_INSET)')
    expect(code).not.toContain('root.top + MAP_TOP_CONTROLS_INSET')
  })
})

/*
  #1232 — 데스크톱 패널은 떠 있는 카드가 아니라 화면 왼쪽에 붙은 스택이다
  (`docs/features/place/지도패널-도킹-세부명세.md` D2 · D4 · D5 · D9).
*/
describe('PlaceMapView — 도킹 스택 (#1232)', () => {
  it('스택이 지도 루트의 왼쪽 위아래 끝까지 붙는다 — 바깥 여백 · 둥근 모서리가 없다', () => {
    expect(code).toContain("'absolute inset-y-0 left-0 z-30 hidden transition-transform lg:block'")
    expect(code).not.toMatch(/top-6 bottom-8 left-4/)
    expect(code).not.toContain('rounded-tr-none')
  })

  it('목록은 오른쪽 경계선 하나로 미리보기와 가른다 — 패널마다 그림자를 두지 않는다', () => {
    expect(code).toContain(
      'map-panel-width bg-bg border-border flex h-full flex-col overflow-hidden border-r',
    )
    expect(code).toContain("panelOpen && 'map-dock-shadow'")
  })

  it('재검색 알약은 남은 지도의 가운데다 — 목록 400 · 1280 부터 미리보기까지 800 · 접히면 0', () => {
    expect(code).toContain("panelOpen && 'lg:left-100'")
    expect(code).toContain("docked && panelOpen && 'xl:left-200'")
  })

  it('카카오 축척 · 로고를 우하단으로 비킨다 — 도킹 스택이 좌하단 로고를 덮는다', () => {
    expect(code).toContain('copyrightPosition="right"')
  })

  /*
    D9 — 담기 화면의 머리는 열린 패널의 맨 위 블록이고, 접힌 동안에만 떠 있는 카드로 돌아온다.
    머리는 그 화면의 유일한 퇴로(#556)라 접어도 닿아야 한다.
  */
  it('머리는 열린 데스크톱 패널 안, 접히면 떠 있는 기둥에 선다 — 한 번에 하나만', () => {
    const inPanel = '{hasHead && <div className="border-border border-b p-3">{head}</div>}'
    // 패널 안 머리는 inert 스택 안이다 — 밖이면 접힌 lg 에서 h1 · 돌아가기가 두 벌 노출된다
    expect(code.indexOf('id={stackId}')).toBeLessThan(code.indexOf(inPanel))
    expect(code.indexOf(inPanel)).toBeLessThan(code.indexOf('aria-controls={stackId}'))
    // 떠 있는 기둥은 열린 lg 에서 숨는다 — 기둥 블록(`{hasHead && (`) 안의 `cn()` 이다
    const start = code.indexOf('{hasHead && (')
    const floating = code.slice(start, code.indexOf('{head}', start))
    expect(floating).toContain("panelOpen && 'lg:hidden'")
  })

  /* 리뷰 지적 — 미리보기가 스택 안이라 접힌 채 고르면 화면 밖 inert 에 마운트됐다 */
  it('미리보기를 열면 접힌 스택을 편다 — 목록 · 시트 · 핀 모두 같은 길이다', () => {
    expect(code).toContain('if (preview && id !== null) setPanelOpen(true)')
    // 지도는 장소 · 시설을 가르는 `selectOnMap` 을 거쳐 장소면 `selectPlace` 로 간다 (#1286)
    expect(code.match(/onSelect=\{selectPlace\}/g)).toHaveLength(2)
    expect(code).toContain('onSelect={selectOnMap}')
    expect(code).toMatch(/if \(picked === null\) selectPlace\(id\)/)
    expect(code).not.toContain('onSelect={setSelectedId}')
  })

  /* 펴는 도중 transform 중간 프레임을 재지 않는다 — 배치 상자는 transform 을 모른다 */
  it('고른 핀 오프셋은 transform 이 아니라 배치 상자로 잰다', () => {
    expect(code).toContain('(panel.offsetLeft + panel.offsetWidth) / 2')
  })

  it('패널 위 여백을 호출부가 정하지 않는다 — 패널이 헤더 바로 아래부터다', () => {
    expect(code).not.toContain('panelTopInset')
  })
})

/*
  #1286 — 병원 · 약국 함께 보기. 조회 · 상태 판정은 `facility-layer.test.ts` · `facility-layer-status.test.ts` 가
  잰다 — 여기서는 화면이 그 조각을 어디에 꽂는지만 본다.
*/
describe('PlaceMapView — 병원 · 약국 층 (#1286)', () => {
  it('기본은 꺼짐이다 — 담기 지도는 토글이 없다', () => {
    expect(code).toContain('facilityLayer = false,')
    expect(code).toContain('const [facilityOn, setFacilityOn] = useState(false)')
    expect(code).toContain('const layerOn = facilityLayer && facilityOn')
    expect(code).toContain('useFacilityLayer(layerOn)')
  })

  it('/places 만 켠다', () => {
    const page = readFileSync(
      fileURLToPath(new URL('../../../app/(main)/places/(list)/page.tsx', import.meta.url)),
      'utf8',
    )
    const plan = readFileSync(
      fileURLToPath(new URL('../plan/plan-add-place-view.tsx', import.meta.url)),
      'utf8',
    )

    expect(page).toMatch(/<PlaceMapView[\s\S]*?\bfacilityLayer\b[\s\S]*?\/>/)
    expect(plan).not.toContain('facilityLayer')
  })

  it('미리보기 자리 조건에 시설이 들어간다 — 같은 칸 · 같은 시트를 번갈아 쓴다', () => {
    expect(code).toContain('const docked = previewId !== null || facilityId !== null')
    expect(code).toContain("docked && 'lg:max-xl:invisible'")
    expect(code).toContain("className={cn(docked && 'hidden')}")
    expect(code.match(/\{docked && \(/g)?.length).toBe(2)
    expect(code.match(/<PlaceMapFacilitySummary/g)?.length).toBe(2)
  })

  it('시설을 고르면 장소 미리보기가 없다 — 동시에 하나만', () => {
    expect(code).toContain('const previewId = preview && facilityId === null ? selectedId : null')
    expect(code).toContain(
      'selectedId={facilityId !== null ? facilityPinId(facilityId) : selectedId}',
    )
  })

  it('장소를 고르면 시설 선택을 비운다', () => {
    const selectPlace = /const selectPlace = [\s\S]*?\n {2}\}/.exec(code)?.[0] ?? ''

    expect(selectPlace).toContain('setPickedFacilityId(null)')
  })

  it('포커스 되돌림 effect 는 시설로 갈아탈 때 건너뛴다', () => {
    const effect =
      /const lastPreviewRef[\s\S]*?\}, \[preview, selectedId, facilityId\]\)/.exec(code)?.[0] ?? ''

    expect(effect).toContain('if (facilityId !== null) return')
  })

  it('요약을 닫으면 포커스를 토글로 돌려준다', () => {
    expect(code).toContain('facilityToggleRef.current?.focus()')
    expect(code).toContain('ref={facilityToggleRef}')
  })

  it('토글은 목록 보기 아래 · 내 위치 위다', () => {
    const viewToggle = code.indexOf('<ViewToggle current="map"')
    const facility = code.indexOf('<PlaceMapFacilityToggle')
    const locate = code.indexOf('<MapLocateButton')

    expect(viewToggle).toBeGreaterThan(-1)
    expect(facility).toBeGreaterThan(viewToggle)
    expect(locate).toBeGreaterThan(facility)
  })

  it('시설 묶음의 이름 틀을 넘긴다', () => {
    expect(code).toContain('squareClusterLabel={messages.map.facilityClusterCount}')
  })
})
