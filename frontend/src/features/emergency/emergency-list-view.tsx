'use client'

import { ViewToggle } from '@/components/view-toggle'
import { EmergencyFilterRail } from '@/features/emergency/emergency-filter-rail'
import { EmergencySection } from '@/features/emergency/emergency-section'
import { emergencySummaryLine } from '@/features/emergency/emergency-summary-line'
import { countsAreComplete, facilityCounts } from '@/features/emergency/facility-filters'
import { type EmergencyBoard, useEmergencyBoard } from '@/features/emergency/use-emergency-board'
import { toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * 목록 갈래 — `?view=list`. **`/places` 목록과 같은 2단이다** (좌 280 필터 레일 / 우 목록, #419).
 *
 * **grid 를 페이지가 아니라 이 컴포넌트가 갖는다.** `/places` 는 레일이 URL 주도라 서버
 * 컴포넌트가 좌측 칸에 바로 꽂지만, 이 화면은 조회에 좌표가 필요해 서버 프리페치가 없고
 * 조건·반경·개수를 `useEmergencyBoard` 가 쥔다. 레일이 보드를 봐야 하므로 grid 가 클라이언트
 * 경계 안으로 들어오고, `h1`·`ViewToggle` 도 우측 열 안이라 함께 내려왔다.
 *
 * **예전에는 `max-w-screen-md`(768) 한 단이었다.** 1920 에서 목록만 768 로 묶여 같은 화면의
 * 보기 토글이 목록↔지도 사이에서 339px 옮겨 다녔다 (#419 실측).
 *
 * **개수는 반경 전량 기준이다** — 이 갈래에는 지도 영역이 없다 (설계 §5-3).
 * 지도 갈래는 `EmergencySection` 을 쓰지 않고 자기 패널 본문을 갖는다.
 */
export function EmergencyListView({ listHref, mapHref }: { listHref: string; mapHref: string }) {
  const board = useEmergencyBoard()

  const result = board.query.data ?? null
  /*
    레일은 **로딩·오류 중에도 남는다.** 목록만 골격으로 바뀌고 좌측 칸이 사라지지 않아야
    조회가 끝날 때 화면이 튀지 않는다. 그때 셀 배열이 없으므로 개수는 0 이고,
    `showCounts` 가 false 라 라벨에서 숫자가 빠진다 — 0 을 사실처럼 적지 않는다.
  */
  const counts = facilityCounts(result?.facilities ?? [])
  // 잘린 목록에서 센 개수는 전체가 아니다 — 틀린 개수는 없는 개수보다 나쁘다
  const showCounts = result !== null && countsAreComplete(result)

  return (
    <div className="rail-layout rail-layout-filter">
      {/* `rail-sticky`(globals.css) — 레일이 뷰포트보다 길어도 바닥에 닿을 수 있게 자기 스크롤을 준다 */}
      <div className="rail-sticky hidden lg:block">
        <EmergencyFilterRail
          filters={board.filters}
          onFiltersChange={board.setFilters}
          radius={board.radius}
          onRadiusChange={board.setRadius}
          counts={counts}
          showCounts={showCounts}
        />
      </div>

      <div className="lg:border-border lg:border-l">
        {/* 좌우 여백은 `FacilityRow`(px-4 md:px-10)와 같은 값이어야 한다 — 어긋나면
            제목과 행 구분선이 다른 축에서 시작해 목록이 어긋나 보인다 */}
        <header className="px-4 pt-5 pb-3 md:px-10 lg:pt-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
              {messages.emergency.pageTitle}
            </h1>
            {/* 세 화면이 같은 세그먼트 컨트롤을 쓴다 */}
            <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
          </div>
          {/* 부제는 데스크톱에서만 — 모바일은 바로 아래 칩이 같은 것을 보여준다 */}
          <p className="text-caption text-fg-muted mt-1 hidden font-medium lg:block">
            {emergencySummaryLine(board.filters, board.radius)}
          </p>
        </header>

        <EmergencyBoardSection board={board} hasRail />
      </div>
    </div>
  )
}

/**
 * 보드를 **받아서** 목록을 그린다. **보드를 만들지 않는다.**
 *
 * 지도 갈래의 SDK 실패 분기가 자기 보드를 그대로 넘기기 위해 갈라 뒀다. 거기서
 * `EmergencyListView` 를 렌더하면 보드가 두 벌이 되어 위치를 두 번 묻고 반경·필터가
 * 갈린다 — SDK 실패는 카카오 키 도메인이 안 맞을 때 **항상** 오는 경로라 예외가 아니다.
 *
 * **`hasRail` 기본값이 false 인 것이 그 갈래를 지킨다** (#419). 폴백에는 레일이 없으므로
 * 칩 줄이 데스크톱에서도 남아야 한다.
 */
export function EmergencyBoardSection({
  board,
  hasRail = false,
}: {
  board: EmergencyBoard
  hasRail?: boolean
}) {
  return (
    <EmergencySection
      result={board.query.data ?? null}
      // 좌표를 기다리는 동안에도 로딩이다 — 조회는 아직 시작도 못 했다
      loading={board.position === null || board.query.isPending}
      errorStatus={toErrorStatus(board.query.error)}
      onRetry={() => void board.query.refetch()}
      filters={board.filters}
      onFiltersChange={board.setFilters}
      positionFallback={board.fallback}
      onRetryPosition={board.locate}
      onWidenRadius={board.widenRadius}
      canWiden={board.canWiden}
      hasRail={hasRail}
    />
  )
}
