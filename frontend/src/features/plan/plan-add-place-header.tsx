import { BackLink } from '@/components/back-link'
import { ViewToggle } from '@/components/view-toggle'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import type { ViewMode } from '@/lib/url/view-mode'
import { cn } from '@/lib/utils/cn'

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
 *
 * **목록 보기는 3층 표면의 L0 위 페이지 머리다** (`DESIGN.md §0`, #451) — 카드가 아니다.
 * 카드 판정 3문에서 ①(자기 제목)·③(항목 여럿)에 걸리고, 장소 상세(#443)·일정 상세(#447)가
 * 같은 자리를 같은 방식으로 두었다.
 */
export function PlanAddPlaceHeader({
  day,
  backHref,
  planTitle,
  listHref,
  mapHref,
  view,
  inset = 'main',
}: {
  day: number
  backHref: string
  /** 아직 못 받았으면 생략한다 — 제목은 `day` 만으로 쓸 수 있다 */
  planTitle?: string | undefined
  listHref: string
  mapHref: string
  view: ViewMode
  /**
   * 좌우 여백 축. **기본은 `main`(16/40)이고 지도 보기가 그것을 쓴다** — 지도는 전폭
   * 미디어라 카드 열이 없다.
   *
   * 목록 보기(`SurfaceStack` 안)는 `card` 를 넘긴다. L0 위에 놓이지만 인셋은 **카드 안
   * 글줄과 같은 축**이어야 아래 카드의 첫 글자와 세로선이 맞는다 — 카드 테두리 1px 만큼
   * (44 vs 45) 어긋나는 것은 #443 · #447 과 같은 의도다.
   */
  inset?: Inset
}) {
  const subtitle = messages.plan.addPlaceSubtitle.replace('{day}', String(day))

  return (
    <header
      className={cn(
        INSET_CLASS[inset],
        // 헤더 배치는 `plan-emergency-section` 주석이 정본이다 (#539)
        'flex flex-wrap items-start gap-x-1 md:block',
        // 데스크톱 세로 여백은 `SurfaceStack` 의 `md:p-6` 이 준다 (#447 개요 패널과 같은 값)
        inset === 'card' ? 'pt-4 pb-4 md:pt-0 md:pb-0' : 'pt-5 pb-3 lg:pt-6',
      )}
    >
      <BackLink href={backHref} label={messages.plan.addPlaceBack} variant="titleRow" />

      {/*
        **제목·부제·토글이 한 덩어리다.** 모바일에서 뒤로가기가 이 줄 왼쪽에 붙어
        `[←][제목 ............ 토글]` 이 되려면 이 `div` 가 남은 폭을 다 먹어야 한다
        (`flex-1`). 부제를 이 안에 두는 이유는 `plan-emergency-section` 주석과 같다 —
        밖에 두면 제목만 40px 밀려 헤더 안에 왼쪽 기준선이 둘이 된다.

        세 화면 중 여기만 제목 줄 오른쪽에 내용이 있다. `ViewToggle`(46px)이 줄 높이를
        키우지만, `BackLink` 의 마진 상자가 제목 첫 줄에 맞춰져 있어 아이콘은 따라가지 않는다.
      */}
      <div className="min-w-0 flex-1 md:flex-none">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-title-1 text-fg lg:text-display font-bold md:mt-1 lg:font-extrabold">
            {messages.plan.addPlaceTitle.replace('{day}', String(day))}
          </h1>
          {/* 네 화면이 같은 세그먼트 컨트롤을 쓴다 — 아트보드 05 마지막 단락 */}
          <ViewToggle current={view} listHref={listHref} mapHref={mapHref} variant="icon" />
        </div>

        <p className="text-caption text-fg-muted mt-1 font-medium">
          {planTitle === undefined ? subtitle : `${planTitle} · ${subtitle}`}
        </p>
      </div>
    </header>
  )
}
