import { ViewToggle } from '@/components/view-toggle'
import { EmergencyView } from '@/features/emergency/emergency-view'
import { messages } from '@/lib/messages'
import { parseViewMode, viewModeHref } from '@/lib/url/view-mode'

export const metadata = {
  title: `${messages.emergency.pageTitle} · 혼디가개`,
  description: messages.emergency.pageDescription,
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * 주변 병원 · 약국 — 아트보드 `혼디가개 긴급 시설` 01(모바일) · 02(지도) ·
 * 03(상태) · 04(데스크톱 2단).
 *
 * **서버 프리페치가 없다.** 조회에 `lat`/`lng` 가 필수인데 좌표는 브라우저에만 있어
 * 서버가 무엇을 조회할지 모른다. `architecture-guide.md` §9 확정표에 이 화면 행이 있다.
 *
 * **지도는 토글이고 목록이 기본이다** (아트보드 02 주석). 응급 화면이라 지도가 늦게
 * 뜨거나 실패해도 전화 거는 데 영향이 없어야 한다 — 그래서 `view` 기본값이 `list` 다.
 * 1024 이상은 토글 없이 좌 목록 480 / 우 지도 2단이라 세그먼트 컨트롤을 감춘다.
 *
 * **폭 제한(max-w-screen-md)을 지도 보기에서 풀었다.** 2단 구조가 그 폭에 들어가지
 * 않는다 — 한 컬럼이던 시절의 제약이다.
 */
export default async function EmergencyPage({ searchParams }: { searchParams: SearchParams }) {
  const view = parseViewMode(await searchParams)

  return (
    <main id="main-content" className="mx-auto w-full max-w-screen-md lg:max-w-none">
      <header className="flex items-start justify-between gap-3 px-4 pt-5 pb-1 md:px-10 lg:pt-6">
        <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
          {messages.emergency.pageTitle}
        </h1>

        {/* 세 화면이 같은 세그먼트 컨트롤을 쓴다. 2단이 되는 1024+ 에서는 필요 없다 */}
        <ViewToggle
          current={view}
          listHref={viewModeHref('/emergency', '', 'list')}
          mapHref={viewModeHref('/emergency', '', 'map')}
          variant="icon"
          className="lg:hidden"
        />
      </header>

      <EmergencyView view={view} />
    </main>
  )
}
