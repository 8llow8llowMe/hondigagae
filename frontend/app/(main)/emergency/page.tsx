import { ViewToggle } from '@/components/view-toggle'
import { EmergencyListView } from '@/features/emergency/emergency-list-view'
import { EmergencyMapView } from '@/features/emergency/emergency-map-view'
import { messages } from '@/lib/messages'
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
 */
export default async function EmergencyPage({ searchParams }: { searchParams: SearchParams }) {
  const view = parseViewMode(await searchParams, EMERGENCY_DEFAULT_VIEW)
  const listHref = viewModeHref('/emergency', '', 'list', EMERGENCY_DEFAULT_VIEW)
  const mapHref = viewModeHref('/emergency', '', 'map', EMERGENCY_DEFAULT_VIEW)

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
