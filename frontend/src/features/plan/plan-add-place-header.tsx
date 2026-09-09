import { BackLink } from '@/components/back-link'
import { ViewToggle } from '@/components/view-toggle'
import { messages } from '@/lib/messages'
import type { ViewMode } from '@/lib/url/view-mode'

/**
 * 담기 화면의 머리 — 뒤로가기 · `h1` · 부제 · 보기 전환.
 *
 * **두 보기가 같은 것을 쓴다** (#370). 목록에서는 본문 위에, 지도에서는 지도 위에 선다.
 *
 * **지도 보기에서도 `sr-only` 로 숨기지 않는다.** `/places` 지도는 전역 nav 로 나갈 수
 * 있지만 이 화면의 퇴로는 `일정으로 돌아가기` 뿐이다 — 접히는 패널이나 시트 안에
 * 숨으면 돌아갈 길이 사라진다.
 *
 * **오류·빈 상태에도 `h1` 이 있어야 한다.** 없으면 문서의 최상위 제목이 필터의
 * `h2 "필터"` 가 되어 스크린리더 사용자가 무슨 화면인지 알 수 없다 (실측으로 잡았다).
 */
export function PlanAddPlaceHeader({
  day,
  backHref,
  planTitle,
  listHref,
  mapHref,
  view,
}: {
  day: number
  backHref: string
  /** 아직 못 받았으면 생략한다 — 제목은 `day` 만으로 쓸 수 있다 */
  planTitle?: string | undefined
  listHref: string
  mapHref: string
  view: ViewMode
}) {
  const subtitle = messages.plan.addPlaceSubtitle.replace('{day}', String(day))

  return (
    <header className="px-4 pt-5 pb-3 md:px-10 lg:pt-6">
      <BackLink href={backHref} label={messages.plan.addPlaceBack} className="-ml-1" />

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-title-1 text-fg lg:text-display mt-1 font-bold lg:font-extrabold">
          {messages.plan.addPlaceTitle.replace('{day}', String(day))}
        </h1>
        {/* 네 화면이 같은 세그먼트 컨트롤을 쓴다 — 아트보드 05 마지막 단락 */}
        <ViewToggle current={view} listHref={listHref} mapHref={mapHref} variant="icon" />
      </div>

      <p className="text-caption text-fg-muted mt-1 font-medium">
        {planTitle === undefined ? subtitle : `${planTitle} · ${subtitle}`}
      </p>
    </header>
  )
}
