'use client'

import { SkipLink } from '@/components/skip-link'
import { Surface, SurfaceStack } from '@/components/surface'
import { ViewToggle } from '@/components/view-toggle'
import { EmergencyFilterChips } from '@/features/emergency/emergency-filter-chips'
import { EmergencyFilterRail } from '@/features/emergency/emergency-filter-rail'
import { EmergencySearchField } from '@/features/emergency/emergency-search-field'
import { EmergencySection } from '@/features/emergency/emergency-section'
import { emergencyHeadSubtitle } from '@/features/emergency/emergency-summary-line'
import {
  countsAreComplete,
  facilityCounts,
  narrowByKeyword,
} from '@/features/emergency/facility-filters'
import { PositionFallbackHead } from '@/features/emergency/position-fallback-head'
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
  /*
    **검색어까지 좁힌 뒤에 센다** (#584). 칩 개수는 "그 칩만 눌렀을 때" 의 수인데, 검색어는
    칩이 아니라 범위라 빼고 세면 검색 중에 칩이 반경 전량의 수를 말한다 — 눌러서 나오는
    결과와 어긋난다 (`facilityCounts` 머리주석).
  */
  const counts = facilityCounts(narrowByKeyword(result?.facilities ?? [], board.filters.keyword))
  // 잘린 목록에서 센 개수는 전체가 아니다 — 틀린 개수는 없는 개수보다 나쁘다
  const showCounts = result !== null && countsAreComplete(result)

  const subtitle = emergencyHeadSubtitle(result)

  return (
    <div className="rail-layout rail-layout-filter">
      {/*
        **`h1` 이 문서의 첫 제목이다** (#546 · #556). 제목이 우측 카드 안으로 내려가면
        DOM 에서 레일의 `h2 필터` 보다 뒤가 되어 제목 탐색 개요가
        `h2 필터 → h3 셋 → h1 병원 · 약국` 이 된다 — #546 이 `.rail-heading` 으로 고쳤던 바로
        그 순서다.

        **`sr-only` 사본으로 되돌린다.** `position: absolute` 라 grid 트랙을 만들지 않아
        2단을 깨지 않으면서 레일보다 앞에 설 수 있다 — `/places` 가 #472 부터 쓰는 방식이고,
        #546 주석이 "이 화면의 `h1` 은 보이는 제목이라 같은 자리로 옮길 수 없다" 고 적어 둔
        제약이 **제목이 카드 머리로 들어가면서 풀렸다.** 보이는 제목은 카드의 `h2` 다.

        지도 갈래(`page.tsx`)가 내는 `h1` 과 같은 문자열이라 보기 전환이 문서 구조를 바꾸지
        않는 것은 그대로다.
      */}
      <h1 className="sr-only">{messages.emergency.pageTitle}</h1>

      {/*
          **`aside` 다 — `complementary` 랜드마크** (#546 · #472 와 같은 처방). 레일은 목록을
          좁히는 도구이고 본문이 아니다. 랜드마크로 내보내야 보조기기가 통째로 건너뛴다.

          **건너뛰기 링크를 레일 맨 앞에 둔다.** 전역 스킵 링크(`#main-content`)는 레일
          **앞**으로 보내므로 이 구간을 건너뛰지 못한다 — 키보드 사용자가 목록에 닿으려면
          검색 반경 · 시설 유형 · 영업 조건 셋을 전부 지나야 했다. `relative` 는 그 링크가
          레일 좌상단에 뜨게 한다 (`SkipLink` 머리주석).

          `rail-column`(globals.css) — **아무도 스크롤하지 않는 열**이다 (#598). 행 높이를
          레일이 정하므로 레일은 언제나 제 길이대로 서고, 넘치는 몫은 페이지가 진다.
        */}
      <aside
        aria-label={messages.place.filterTitle}
        className="rail-column relative hidden lg:block"
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

      <SurfaceStack id={LIST_ANCHOR_ID} tabIndex={-1} className="list-column">
        {/*
          **제목과 도구가 카드 머리로 들어왔다** (#556). #537 이 제목을 카드 밖으로 꺼낸 것은
          "필터가 카드 밖인 이상 제목도 카드 밖이어야 한다" 는 이유였는데, 이제 **둘 다 카드
          머리 안**이라 그 전제가 사라졌다 — 제목이 필터보다 위라는 #537 의 결론은 머리 안에서
          그대로 지켜진다.

          **모바일 칩도 머리 안이다.** 필터는 목록을 좁히는 도구이고 본문은 그 결과다 —
          갈리는 축이 "카드 안/밖" 에서 "머리/본문" 으로 옮겨 갔다 (`Surface` 의 `fill` 절).
          `lg:hidden` 은 레일과 칩이 같은 축을 두 번 보여주지 않게 하는 것이고, 지도 SDK
          폴백은 레일이 없어 그 클래스를 걸지 않는다 (`emergency-map-view.tsx`).
        */}
        <Surface
          fill
          titleId="emergency-list-heading"
          title={messages.emergency.pageTitle}
          /*
            **부제는 개수 한 줄이다** (#639). "제주에 몇 곳이 있고 지금 몇 곳이 열려
            있나" 는 이 화면에 온 이유 자체라 모든 폭에서 선다. 응답 전·잘린 목록에서는
            `null` 이라 줄이 아예 서지 않는다 (`emergencyHeadSubtitle`).

            **조건 줄(`emergencySummaryLine`)은 걷었다.** 데스크톱 전용 둘째 줄이었는데
            1280 실측에서 `10.0km` 홀로 서서 무슨 값인지 읽히지 않았다 — 반경은 좌측
            레일의 선택값과 목록 위 요약 줄(`가까운 순 · 반경 10.0km`)이 이미 말한다.
          */
          description={
            subtitle === null ? undefined : (
              <p className="text-caption text-fg-muted font-medium tabular-nums">{subtitle}</p>
            )
          }
          /* 네 화면이 같은 세그먼트 컨트롤을 쓴다 */
          trailing={
            <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
          }
          /*
            **검색은 `lg:hidden` 이 아니다** (#584). 아래 칩 줄은 레일이 같은 축을 두 번
            보여주지 않도록 데스크톱에서 숨지만, 검색은 레일에 짝이 없다 — 레일에 넣으면
            1024 미만에서 통째로 사라진다 (`EmergencySearchField` 머리주석).

            **도구는 머리의 좌우 여백 밖이라 인셋을 스스로 든다** (`Surface` 머리주석).
            아래 여백은 칩 줄의 `py-3` 과 머리 래퍼의 `pb-3` 이 진다.
          */
          tools={
            <>
              {/*
                **위치 폴백 블록이 검색·칩보다 위다** (#639). 칩은 결과를 *좁히는* 도구지만
                이 블록은 **무엇을 기준으로 찾을지** — 결과의 전제다. 전제가 도구 아래
                서면 사용자는 좁히기부터 시작한 뒤에야 기준이 틀렸다는 것을 안다.

                머리(고정 영역)라 목록을 굴려도 남는다. 예전 `PositionNotice` 는 본문
                맨 위였고 스크롤 한 번이면 사라졌다.
              */}
              <PositionFallbackHead
                reason={board.fallback}
                regionCode={board.regionCode}
                onRegionChange={board.researchAtRegion}
                onLocate={board.locate}
              />
              <EmergencySearchField
                filters={board.filters}
                onFiltersChange={board.setFilters}
                className={cn('pt-3', INSET_CLASS.card)}
              />
              <EmergencyFilterChips
                filters={board.filters}
                onFiltersChange={board.setFilters}
                radius={board.radius}
                onRadiusChange={board.setRadius}
                counts={counts}
                showCounts={showCounts}
                className="lg:hidden"
              />
            </>
          }
        >
          {/* 카드가 `h2` 를 되찾았으므로 상태 제목이 한 단 내려간다 (#456① · #556) */}
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
      basis={board.basis}
      regionCode={board.regionCode}
      onWidenRadius={board.widenRadius}
      canWiden={board.canWiden}
      inset={inset}
      headingLevel={headingLevel}
    />
  )
}
