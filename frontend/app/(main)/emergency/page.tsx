import { Canvas } from '@/components/surface'
import { EmergencyListView } from '@/features/emergency/emergency-list-view'
import { EmergencyMapView } from '@/features/emergency/emergency-map-view'
import { messages } from '@/lib/messages'
import { parseEmergencyBoardParams, toEmergencyBoardQuery } from '@/lib/url/emergency-filters'
import { EMERGENCY_DEFAULT_VIEW, parseViewMode, viewModeHref } from '@/lib/url/view-mode'

export const metadata = {
  title: `${messages.emergency.pageTitle} · 혼디가개`,
  description: messages.emergency.pageDescription,
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * 주변 병원 · 약국.
 *
 * **서버 프리페치가 없다.** 조회에 `lat`/`lng` 가 필수인데 좌표는 브라우저에만 있어
 * 서버가 무엇을 조회할지 모른다 (`architecture-guide.md` §9 확정표에 이 화면 행이 있다).
 *
 * **지도 갈래는 폭 제한과 헤더가 없다.** 지도가 바탕이고 목록이 그 위에 얹히므로
 * 제목이 들어갈 자리가 없다 — `/places` 지도 보기와 같은 구조다.
 *
 * **`searchParams` 를 프리페치가 아니라 토글 링크를 만들려고 읽는다.** 조건은 클라이언트
 * 훅(`useEmergencyNav`)이 다시 읽지만, 보기 전환 링크는 서버에서 조립되므로 조건을 여기서
 * 한 번 더 붙여야 한다 — 비워 두면 목록↔지도 전환이 좁힌 조건을 통째로 버린다.
 * parse → serialize 왕복이라 손으로 고친 값도 여기서 정규화된다.
 */
export default async function EmergencyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const view = parseViewMode(params, EMERGENCY_DEFAULT_VIEW)
  const query = toEmergencyBoardQuery(parseEmergencyBoardParams(params))
  const listHref = viewModeHref('/emergency', query, 'list', EMERGENCY_DEFAULT_VIEW)
  const mapHref = viewModeHref('/emergency', query, 'map', EMERGENCY_DEFAULT_VIEW)

  if (view === 'map') {
    return (
      <main id="main-content">
        <h1 className="sr-only">{messages.emergency.pageTitle}</h1>
        <EmergencyMapView listHref={listHref} mapHref={mapHref} />
      </main>
    )
  }

  /*
    **폭도 헤더도 여기서 정하지 않는다** (#419). 목록 갈래가 `/places` 와 같은 2단
    (좌 280 필터 레일 / 우 목록)이 되면서 grid 가 `EmergencyListView` 안으로 들어갔다 —
    레일이 `useEmergencyBoard` 의 조건·반경·개수를 봐야 하는데 이 화면은 좌표가 브라우저에만
    있어 서버가 그것을 알 수 없다. `h1`·`ViewToggle` 도 우측 열 안이라 같이 내려갔다.

    예전에는 여기에 `max-w-screen-md`(768)가 있었고, 1920 에서 목록만 768 로 묶여
    보기 토글이 목록↔지도 사이에서 339px 옮겨 다녔다.

    **`main` 이 L0 바닥이다** (`DESIGN.md §0`, #460). 바닥은 전폭이어야 하므로 `Canvas` 를
    `main` 에 걸고, 카드를 쌓는 일은 `EmergencyListView` 의 `SurfaceStack` 이 맡는다 —
    장소 목록(#439) · 일정 목록(#445)과 같은 3층 표면. 지도 갈래(위)는 전폭 미디어라
    카드 판정에서 빠지고(§0), `Canvas` 도 없다 — 지도가 바닥이다.
  */
  return (
    <Canvas as="main" id="main-content">
      <EmergencyListView listHref={listHref} mapHref={mapHref} />
    </Canvas>
  )
}
