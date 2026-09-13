'use client'

import { SkipLink } from '@/components/skip-link'
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
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 건너뛰기 링크의 목적지 — 레일 맨 앞 링크와 `SurfaceStack` 의 `id` 가 같은 값을 써야
 * 한다. 문자열을 두 곳에 적으면 갈렸을 때 링크가 조용히 아무 데도 가지 않는다.
 */
const LIST_ANCHOR_ID = 'emergency-list'

/**
 * 목록 갈래 — `?view=list`. **`/places` 목록과 같은 2단이다** (좌 280 필터 레일 / 우 목록, #419).
 *
 * **grid 를 페이지가 아니라 이 컴포넌트가 갖는다.** `/places` 는 레일이 URL 주도라 서버
 * 컴포넌트가 좌측 칸에 바로 꽂지만, 이 화면은 조회에 좌표가 필요해 서버 프리페치가 없고
 * 조건·반경·개수를 `useEmergencyBoard` 가 쥔다. 레일이 보드를 봐야 하므로 grid 가 클라이언트
 * 경계 안으로 들어오고, 제목·`ViewToggle` 도 함께 내려왔다 — #537 에서 카드 밖으로,
 * #546 에서 **두 열 위**로 올라갔다 (`.rail-heading`).
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
      {/*
          **제목 줄이 맨 위다** (#537). 예전에는 카드 **위**에 모바일 칩 다섯 개가 두 줄로
          깔리고 제목은 그 아래 카드의 `h2` 였다 — 375 에서 페이지에 들어온 사용자가
          "여기가 어디인가" 를 알기 전에 필터 두 줄을 먼저 지났고, 보기 토글은 그보다도 더
          아래라 지도 갈래의 떠 있는 토글과 세로 위치가 크게 어긋났다. 급할 때 여는
          화면이라 그 순서가 특히 나빴다.

          **그래서 제목이 카드 밖으로 나왔다.** §0 의 "섹션 제목은 섹션 안에 있다" 를
          되돌린 것이 아니라, **페이지 머리(h1)는 카드가 아니다** 는 같은 §0 의 다른 조항을
          적용한 것이다 — 제목이 필터보다 위에 서려면 필터가 카드 밖인 이상 제목도 카드
          밖이어야 한다. 카드는 `aria-label` 로 이름을 갖는다 (담기 화면과 같은 모양 —
          `EmergencySectionProps.headingLevel` 주석이 그 조합을 이미 적어 뒀다).

          **`/places` 는 다른 처방이다.** 거기는 `h1` 이 `sr-only` 라 `.rail-layout` 맨 앞으로
          그냥 옮기면 끝이었다(#472) — `position: absolute` 라 grid 트랙도 만들지 않는다.
          이 화면의 `h1` 은 보이는 제목이라 같은 자리로 옮기면 grid 아이템이 되어 2단이
          깨지고, 그래서 `.rail-heading` 이 필요했다.

          `h1` 이 이제 **보이는** 제목이라 `sr-only` 를 걷었다. 지도 갈래(`page.tsx`)가 내는
          `h1` 과 같은 문자열이라 보기 전환이 문서 구조를 바꾸지 않는 것은 그대로다.
        */}
      {/*
          **제목 줄이 `SurfaceStack` 밖으로 나왔다** (#546). 스택 안에 있는 동안에는 그것이
          곧 **우측 열 안**이라, 1024 이상에서 `h1` 이 레일의 `h2 필터` 보다 DOM 뒤였다 —
          제목 탐색 개요가 `h2 필터 → h3 셋 → h1 병원 · 약국` 이었다(1280 실측).
          `.rail-heading`(globals.css)이 이 줄을 **두 열 위**에 얹어 순서를 바로잡는다.

          **밖으로 나오면서 스택이 주던 여백을 스스로 진다.** 바깥이 `md:px-6` 으로 스택의
          `md:p-6` 자리를, 안쪽이 `INSET_CLASS.card` 로 카드 인셋을 쓴다 — 합이 768 에서
          44 로 **지금과 같은 값**이다. 아래쪽도 같다: 모바일 `pb-2`(8) 는 스택의 `gap-2`,
          `md:pb-6`(24) 는 `md:gap-6` 과 같은 값이고, 스택이 `md:pt-0` 으로 자기 위 여백을
          내놓아 두 번 들어가지 않는다.
        */}
      {/*
          **인셋은 칩·행과 같은 `card` 다** (`inset.ts`). 왼쪽 세로선은 페이지가 하나로
          쓰는 기준선이라 제목만 다른 값을 쓰면 768 에서 제목 24 · 필터 44 · 행 44 로
          한 번 꺾인다 (#537 이 실측으로 잡았다). 카드 밖이라고 `main`(40)을 쓰는 것도
          아니다 — 1024 에서 레일 카드 모서리가 그 40 을 이미 지고 있고(`.filter-rail`),
          이 줄은 카드가 아니라 그 위에 선 **글줄**이다.
        */}
      <div className="rail-heading pb-2 md:px-6 md:pt-6 md:pb-6">
        <div
          className={cn('flex items-center justify-between gap-3 pt-3 md:pt-0', INSET_CLASS.card)}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-title-1 text-fg font-semibold break-keep">
              {messages.emergency.pageTitle}
            </h1>
            {/* 부제는 데스크톱에서만 — 모바일은 아래 칩이 같은 것을 보여준다 */}
            <p className="text-caption text-fg-muted hidden font-medium lg:block">
              {emergencySummaryLine(board.filters, board.radius)}
            </p>
          </div>

          {/* 세 화면이 같은 세그먼트 컨트롤을 쓴다 */}
          <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
        </div>
      </div>

      {/*
          **`aside` 다 — `complementary` 랜드마크** (#546 · #472 와 같은 처방). 레일은 목록을
          좁히는 도구이고 본문이 아니다. 랜드마크로 내보내야 보조기기가 통째로 건너뛴다.

          **건너뛰기 링크를 레일 맨 앞에 둔다.** 전역 스킵 링크(`#main-content`)는 레일
          **앞**으로 보내므로 이 구간을 건너뛰지 못한다 — 키보드 사용자가 목록에 닿으려면
          검색 반경 · 시설 유형 · 영업 조건 셋을 전부 지나야 했다. `relative` 는 그 링크가
          레일 좌상단에 뜨게 한다 (`SkipLink` 머리주석).

          `rail-sticky`(globals.css) — 레일이 뷰포트보다 길어도 바닥에 닿을 수 있게 자기
          스크롤을 준다.
        */}
      <aside
        aria-label={messages.place.filterTitle}
        className="rail-sticky relative hidden lg:block"
      >
        <SkipLink href={`#${LIST_ANCHOR_ID}`}>{messages.common.skipToList}</SkipLink>
        <EmergencyFilterRail
          filters={board.filters}
          onFiltersChange={board.setFilters}
          radius={board.radius}
          onRadiusChange={board.setRadius}
          counts={counts}
          showCounts={showCounts}
        />
      </aside>

      {/*
          **스택이 `md:pt-0` 이다** — 위 제목 줄이 `md:pb-6` 으로 그 간격을 이미 냈다.
          둘 다 두면 768 에서 제목과 칩 사이가 48 로 벌어진다.
        */}
      <SurfaceStack id={LIST_ANCHOR_ID} tabIndex={-1} className="md:pt-0">
        {/*
          **모바일 필터는 카드 밖이다.** 필터는 목록을 좁히는 **도구**이고 카드는 그 결과를
          담는다 — §0 의 카드 판정 3문에서 ① 자기 제목이 없어 걸린다 (#439 · #445 와 같은
          판단). 축이 셋으로 늘었어도(#537 이 반경을 올렸다) 판정은 그대로다: 제목이 없고,
          떼어 놓으면 무엇을 좁히는지 알 수 없다.

          **데스크톱 레일은 반대로 카드다** (#535) — 자기 제목과 축 셋을 갖고 랜드마크로
          혼자 선다. 근거는 `app/globals.css` 의 `.filter-rail` 주석이 정본이다.

          `lg:hidden` 은 레일과 칩이 같은 축을 두 번 보여주지 않게 하는 것이다 — 지도 SDK
          폴백은 레일이 없어 이 클래스를 걸지 않는다 (`emergency-map-view.tsx`).
        */}
        <EmergencyFilterChips
          filters={board.filters}
          onFiltersChange={board.setFilters}
          radius={board.radius}
          onRadiusChange={board.setRadius}
          counts={counts}
          showCounts={showCounts}
          className="lg:hidden"
        />

        {/*
          **카드가 제목을 갖지 않으므로 `aria-label` 로 이름을 준다.** `titleId` 와 함께
          주지 않는다 — 접근성 이름이 둘이 된다 (`Surface` 머리주석).
        */}
        <Surface aria-label={messages.emergency.pageTitle}>
          {/* 카드가 `h2` 를 그리지 않으므로 상태 제목이 문서의 두 번째 단이다 (#456①) */}
          <EmergencyBoardSection board={board} headingLevel={2} />
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
 * 갖지 않는 쪽이 기본이다.
 *
 * **지금은 두 사용처가 다 기본값이다** (#537). 목록 갈래가 한동안 `3` 을 넘겼는데,
 * 제목이 카드 밖 제목 줄로 올라가면서 그 카드가 `h2` 를 잃었다 — `3` 이 남아 있었다면
 * 카드 제목 없이 `h1` → `h3` 로 레벨을 건너뛴다. **그래도 목록 갈래는 `2` 를 명시한다**:
 * 값을 지우면 "이 카드가 제목을 갖는가" 라는 판단이 소스에서 사라져, 제목을 카드로
 * 되돌리는 변경이 아무 데서도 걸리지 않는다 (`state-heading-level.test.ts` 가 그 짝이다).
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
