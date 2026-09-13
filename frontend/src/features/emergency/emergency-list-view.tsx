'use client'

import { Surface, SurfaceStack } from '@/components/surface'
import { ViewToggle } from '@/components/view-toggle'
import { EmergencyFilterChips } from '@/features/emergency/emergency-filter-chips'
import { EmergencyFilterRail } from '@/features/emergency/emergency-filter-rail'
import { EmergencySection } from '@/features/emergency/emergency-section'
import { emergencySummaryLine } from '@/features/emergency/emergency-summary-line'
import { countsAreComplete, facilityCounts } from '@/features/emergency/facility-filters'
import { type EmergencyBoard, useEmergencyBoard } from '@/features/emergency/use-emergency-board'
import { toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import type { Inset } from '@/lib/ui/inset'

/**
 * 목록 갈래 — `?view=list`. **`/places` 목록과 같은 2단이다** (좌 280 필터 레일 / 우 목록, #419).
 *
 * **grid 를 페이지가 아니라 이 컴포넌트가 갖는다.** `/places` 는 레일이 URL 주도라 서버
 * 컴포넌트가 좌측 칸에 바로 꽂지만, 이 화면은 조회에 좌표가 필요해 서버 프리페치가 없고
 * 조건·반경·개수를 `useEmergencyBoard` 가 쥔다. 레일이 보드를 봐야 하므로 grid 가 클라이언트
 * 경계 안으로 들어오고, 제목·`ViewToggle` 도 우측 열 안이라 함께 내려왔다.
 * **바닥(`Canvas`)은 페이지의 `main` 이 깐다** — 바닥은 전폭이어야 하고 grid 는 1440 컨테이너
 * 안이라 둘을 한 요소로 둘 수 없다 (§0 · `styling-guide.md` §3-1).
 *
 * **3층 표면** (`DESIGN.md §0`, #460 — 로드맵 #455 의 7번). 우측 열은 `SurfaceStack` 하나고
 * 목록이 L1 카드 하나다 — 장소 목록(#439) · 일정 목록(#445)과 같은 모양. **열 구분선을
 * 걷었다** — L0 바닥이 열 사이로 비쳐 그 일을 한다. 로딩·오류·0건·목록이 전부 같은 카드
 * 안이라 상태가 바뀌어도 카드가 생겼다 사라지지 않는다.
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
    레일과 칩은 **로딩·오류 중에도 남는다.** 목록만 골격으로 바뀌고 도구가 사라지지 않아야
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

      <SurfaceStack>
        {/*
          **필터는 카드 밖이다.** 칩은 목록을 좁히는 **도구**이고 카드는 그 결과를 담는다 —
          §0 의 카드 판정 3문에서 "혼자 떼어놔도 말이 되는가" 에 걸린다. 데스크톱 레일이
          카드 밖에 서 있는 것과 같은 자리다 (#439 · #445 와 같은 판단).

          `lg:hidden` 은 레일과 칩이 같은 축을 두 번 보여주지 않게 하는 것이다 — 지도 SDK
          폴백은 레일이 없어 이 클래스를 걸지 않는다 (`emergency-map-view.tsx`).
        */}
        <EmergencyFilterChips
          filters={board.filters}
          onFiltersChange={board.setFilters}
          counts={counts}
          showCounts={showCounts}
          className="lg:hidden"
        />

        {/*
          **페이지 제목이 카드 제목으로 들어왔다** (§0 "섹션 제목은 섹션 안에 있다"). 카드가
          하나뿐이고 그 이름이 곧 페이지의 이름이라, 밖에 두면 어느 묶음의 제목인지 모호해진다.
          보이는 제목은 카드의 `h2`, 페이지의 `h1` 은 `sr-only` — 지도 갈래(`page.tsx`)가 내는
          것과 같은 `h1` 이라 보기 전환이 문서 구조를 바꾸지 않는다 (#439 방식).
        */}
        <h1 className="sr-only">{messages.emergency.pageTitle}</h1>

        <Surface
          lead
          titleId="emergency-list-heading"
          title={messages.emergency.pageTitle}
          /* 부제는 데스크톱에서만 — 모바일은 위의 칩이 같은 것을 보여준다 */
          description={
            <p className="text-caption text-fg-muted hidden font-medium lg:block">
              {emergencySummaryLine(board.filters, board.radius)}
            </p>
          }
          /* 세 화면이 같은 세그먼트 컨트롤을 쓴다 */
          trailing={
            <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
          }
        >
          {/* 이 카드가 `h2`(`title`)를 그리므로 상태 제목은 한 단 내려간다 (#456①) */}
          <EmergencyBoardSection board={board} headingLevel={3} />
        </Surface>
      </SurfaceStack>
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
 * **`inset` 기본값이 `card` 다** (#460). 목록 갈래는 이것을 `Surface` 안에 담고, 폴백은
 * 카드 없는 페이지에 세우므로 `main` 을 넘긴다 — 넘기지 않으면 폴백의 행만 20 에 서고
 * 안내 줄은 40 에 서서 세로선이 갈린다 (#452 리뷰가 담기 화면에서 잡은 회귀).
 *
 * **`headingLevel` 은 기본값이 `2` 다** (#456①). 두 축의 기본값이 반대인 것이 의도다 —
 * `inset` 은 "카드 안인가" 라 카드가 기본이고, 이쪽은 "그 카드가 `h2` 를 갖는가" 라
 * 갖지 않는 쪽이 기본이다. 목록 갈래만 제목 있는 카드에 담으므로 거기서 `3` 을 넘긴다.
 */
export function EmergencyBoardSection({
  board,
  inset = 'card',
  headingLevel = 2,
}: {
  board: EmergencyBoard
  inset?: Inset
  headingLevel?: 2 | 3
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
      inset={inset}
      headingLevel={headingLevel}
    />
  )
}
