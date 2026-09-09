import { ViewToggle } from '@/components/view-toggle'
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

  return (
    <main id="main-content" className="mx-auto w-full max-w-screen-md">
      <header className="flex items-start justify-between gap-3 px-4 pt-5 pb-1 md:px-10 lg:pt-6">
        <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
          {messages.emergency.pageTitle}
        </h1>

        {/* 세 화면이 같은 세그먼트 컨트롤을 쓴다 */}
        <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
      </header>

      <EmergencyListView />
    </main>
  )
}
