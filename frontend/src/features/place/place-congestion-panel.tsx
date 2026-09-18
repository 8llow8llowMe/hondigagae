import Link from 'next/link'

import { MetricBadge } from '@/components/metric'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { Skeleton } from '@/components/skeleton'
import {
  barHeightPercent,
  CONGESTION_DAYS,
  type CongestionDays,
  congestionRateSummary,
  formatCongestionRange,
  hasCongestionAnswer,
  isCongestionEmpty,
  splitDay,
} from '@/lib/insight/congestion'
import { congestionTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_BLEED_END_CLASS, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { DailyCongestionItem, PlaceCongestionResponse } from '@/types/insight'

/** L1 카드 안의 L2 다 — 인셋은 카드 값(16/20)이다 (`DESIGN.md §0`) */
const INSET = INSET_CLASS.card

/** 카드 제목이 이 섹션의 접근성 이름이 된다 — `Surface titleId` 가 가리킨다 */
export const CONGESTION_HEADING_ID = 'place-congestion-heading'

export type PlaceCongestionPanelProps = {
  /** 조회 전이거나 실패면 null */
  data: PlaceCongestionResponse | null
  loading: boolean
  failed: boolean
  onRetry: () => void
  /** 지금 보고 있는 기간 */
  days: CongestionDays
  onDaysChange: (days: CongestionDays) => void
}

/**
 * 기간 혼잡도 — 장소 상세의 판정 카드 **아래** 새 L1 카드 (#430).
 *
 * **판정 둘과 시간 축이 다르다.** 적합도는 "오늘 가도 되나", 산책 위험도는 "지금 걷기
 * 안전한가", 이 카드는 **"이번 주엔 언제"** 다. 세 개가 같은 장소를 다른 축으로 말하므로
 * 나란히 서면 서로를 설명한다 — 그래서 별도 화면(`/places/[placeId]/congestions`)이 아니라
 * 같은 화면의 다음 카드다. 진입 동선을 새로 뚫을 필요도 없고 `placeId` 가 이미 여기 있다.
 *
 * 지키는 것:
 * - **서버가 고른 날(`leastCrowded`)을 그대로 쓴다.** FE 가 최저값을 다시 고르지 않는다 —
 *   규칙(`UNKNOWN` 제외 최저 집중률, 동률이면 이른 날짜)이 두 곳에 있으면 같은 기간에
 *   다른 날을 추천하게 된다
 * - **`leastCrowded` 가 `null` 이면 자리를 만들지 않는다.** 아는 날이 하나도 없다는 뜻이라
 *   빈 자리는 "한산한 날이 없다" 로 읽힌다
 * - **`UNKNOWN` 날짜를 걸러내지 않는다.** 빠뜨리면 날짜 축에 구멍이 생겨 그 날이 한산한
 *   날로 읽힌다 — 서버가 데이터 없는 날짜를 목록에 남겨 보내는 이유와 같다
 * - **기간 표기는 응답의 `fromDate` · `toDate` 다.** `days` 로 계산하지 않는다
 *
 * **막대다.** 선 그래프는 값 사이를 이어 연속적인 추세로 읽히게 하는데 혼잡도는 날짜마다
 * 끊긴 값이고 중간에 모르는 날이 섞인다. 히트맵은 칸의 높이를 없애 집중률 차이를 색 단계로만
 * 남긴다. 사용자가 하는 일은 **어느 칸이 낮은가를 한눈에 고르는 것**이다.
 *
 * props 로만 데이터를 받는 presentational 컴포넌트다 — node 환경에서 테스트하기 위해서다
 * (docs/testing-guide.md §1).
 */
export function PlaceCongestionPanel({
  data,
  loading,
  failed,
  onRetry,
  days,
  onDaysChange,
}: PlaceCongestionPanelProps) {
  /*
    **자료가 0건이면 기간을 제시하지 않는다** (#731). `8.29 – 9.27` 이 남으면 카드가
    "이 30일치를 재어 봤다" 고 말하는데 본문은 "잰 것이 없다" 고 말해 **말과 화면이
    어긋난다.** 꼬리표를 통째로 내리는 쪽을 골랐다 — 빈 상태 문구 안으로 기간을 옮기는
    안도 있었지만, 그러면 문구가 "9.27 까지 자료가 없어요" 가 되어 **날짜 범위가 사실을
    좁히는 것처럼** 읽힌다. 자료는 그 기간 밖에도 없다.
  */
  const range =
    data === null || isCongestionEmpty(data)
      ? null
      : formatCongestionRange(data.fromDate, data.toDate)

  return (
    <div className={cn('flex flex-col gap-3 py-4', INSET)}>
      <div className="flex items-baseline justify-between gap-3">
        {/*
          `scroll-mt-20` 은 판정 요약 3줄의 `덜 붐비는 날` 이 이리로 뛰기 때문이다 (#650).
          이 `h2` 는 **패널이 직접 그린다** — `Surface` 는 `title` 없이 `titleId` 만 받아
          `aria-labelledby` 로만 쓰므로 `Surface` 쪽 `scroll-mt` 가 여기엔 닿지 않는다.
        */}
        <h2
          id={CONGESTION_HEADING_ID}
          className="text-title-2 text-fg scroll-mt-20 font-semibold break-keep"
        >
          {messages.place.detailCongestionTitle}
        </h2>
        {/* 기간이 없으면 꼬리표 자체를 내지 않는다 — 라벨만 남은 자리를 두지 않는다 */}
        {range !== null && (
          <span className="text-caption text-fg-muted shrink-0 font-medium tabular-nums">
            {range}
          </span>
        )}
      </div>

      <PanelBody
        data={data}
        loading={loading}
        failed={failed}
        onRetry={onRetry}
        days={days}
        onDaysChange={onDaysChange}
      />
    </div>
  )
}

/** 제목은 어느 상태에서나 선다 — 아래만 배타적으로 갈린다 */
function PanelBody({
  data,
  loading,
  failed,
  onRetry,
  days,
  onDaysChange,
}: PlaceCongestionPanelProps) {
  if (loading) return <BodySkeleton />

  /*
    **이 카드만 덮는다.** 판정 둘과 기본 정보는 그대로 쓸모가 있다 — 적합도 패널이
    화면 전체를 에러로 덮지 않는 것과 같은 판단이다.
  */
  if (failed || data === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-body-2 text-fg-muted">{messages.place.detailCongestionErrorTitle}</p>
        <button
          type="button"
          onClick={onRetry}
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.common.retry}
        </button>
      </div>
    )
  }

  /*
    **`leastCrowded` 가 null 이면 전부 모르는 날이다** — 그때는 점선의 뜻을 설명하는 대신
    이 장소에 자료가 없다는 사실을 말한다. 404 가 아니라 빈 상태라 재시도를 달지 않는다:
    장소는 있고 연결된 관광지 통계가 없는 것이다.

    **본문이 통째로 갈린다** (#670). 예전에는 차트를 그대로 그리고 그 아래에 문구를 붙였는데,
    기본이 30일이라 점선 트랙 30칸이 카드를 채우고 설명은 그 아래 12px 로 붙어 **먼저 읽히는
    것이 "깨진 그래프"** 였다. 추천일 줄(`LeastCrowded`)은 어차피 `null` 에서 아무것도 그리지
    않고, 점선 설명·예측 범위·기간 토글도 이 갈래에는 서지 않는다.

    **이제 차트 자체를 그리지 않는다** (#731) — 자세한 근거는 `EmptyBody` 머리주석에 있다.
  */
  if (!hasCongestionAnswer(data)) return <EmptyBody />

  const hasUnknown = data.dailyCongestions.some((item) => item.concentrationRate === null)

  return (
    <>
      <LeastCrowded item={data.leastCrowded} items={data.dailyCongestions} />

      <Chart items={data.dailyCongestions} pickedDate={data.leastCrowded.date} days={days} />

      {hasUnknown && (
        <p className="text-caption text-fg-muted">{messages.place.detailCongestionUnknownNote}</p>
      )}
      {days === CONGESTION_DAYS.month && (
        <p className="text-caption text-fg-muted">{messages.place.detailCongestionExtendedNote}</p>
      )}

      <DaysToggle days={days} onDaysChange={onDaysChange} />
    </>
  )
}

/**
 * 자료가 하나도 없을 때 — **차트를 그리지 않는다** (#731).
 *
 * #670 은 차트를 남기고 veil 로 덮었다. 근거는 _"남은 칸 수·트랙 높이·날짜 축이 여기는
 * 날짜별 붐빔을 보는 자리라고 말해 준다"_ 였는데, 390 실측에서 그 자리 설명이 **미완성
 * 차트**로 읽혔다. #708 이 문구에 불투명 면을 주자 오히려 "무언가를 덮고 있다" 는 인상이
 * 강해졌다 — 덮개가 또렷할수록 그 아래에 볼 것이 있다는 말이 된다.
 *
 * 그리지 않으면 그 갈래의 결함 넷이 한꺼번에 사라진다.
 *
 *  1. **점선이 예외 표시로 돌아온다.** 정상 갈래에서는 31칸 중 한 칸에만 쓰여 "아직 모르는
 *     날" 을 또렷이 말한다. 같은 기호를 30칸 전부에 쓰면 신호가 아니라 잡음이고, 사용자는
 *     로딩이 끝나기를 기다린다
 *  2. **날짜 축 30개가 사라진다.** "자료가 없다" 고 말하면서 날짜만 정상 갈래와 같은 색으로
 *     또렷하던 모순이 없어진다 (기간 꼬리표도 같은 이유로 내린다 — `PlaceCongestionPanel`)
 *  3. **볼 것이 없는데 가로로 구르던 레일이 없어진다** (실측 `scrollWidth` 1254 / 358)
 *  4. 정상 갈래에 있던 **트랙 채움(`bg-band`)이 없어 빈 상자들이 공중에 뜨던** 것도 함께
 *
 * **블록 하나다.** 정상 갈래에서 `LeastCrowded` 요약이 서던 **같은 자리에 같은 개수**로
 * 선다 — 갈래가 달라도 카드의 골격이 흔들리지 않는다. `aria-hidden` 도, veil 도, 그것을
 * 앉힐 `relative` 래퍼도 이제 필요 없다: 가릴 것이 없으면 덮개도 없다.
 *
 * **`EmptyState` 를 쓰지 않는다.** 그쪽은 화면·섹션 단위의 빈 상태라 자기 인셋과 `py-12`
 * 와 heading 을 갖는다 — 이 카드는 이미 `h2` 를 그렸고 여기 두 줄은 제목이 아니다.
 *
 * **`role="status"` 를 쓰지 않는다** — 진입 시점의 정적 콘텐츠지 갱신이 아니다.
 */
function EmptyBody() {
  return (
    <div className={EMPTY_BLOCK}>
      {/* 문구 키를 새로 만들지 않는다 — #708 이 상자에 담은 두 줄 그대로다 */}
      <p className="text-body-2 text-fg font-semibold break-keep">
        {messages.place.detailCongestionEmptyTitle}
      </p>
      <p className="text-caption text-fg-muted break-keep">
        {messages.place.detailCongestionEmptyDescription}
      </p>

      {/*
        **이 하나만은 누를 것을 둔다** (#731). #670 은 "누를 것이 생기는 순간 사용자는 이것을
        고칠 수 있는 오류로 읽는다" 며 버튼·링크를 전부 뺐는데, 그 판단이 겨눈 것은 **재시도**
        였다 — 눌러도 같은 빈 답이 오는 버튼. 이 링크는 이 카드를 고치려 하지 않고 **다음에
        갈 곳**으로 보낸다 (`EmptyState.action` 이 "재시도가 아니라 다음 행동" 인 것과 같다).
        재시도(`messages.common.retry`)는 그대로 이 갈래에 없다.

        **같은 시군구로 좁히지 못한다.** 장소 상세 응답(`PlaceDetailResponse`)에
        `sigunguCode` 가 없다 — 목록 항목에만 있고 상세에는 내려오지 않는다
        (`types/place.ts`). 없는 값을 추측해 `?sigunguCode=` 를 붙이면 링크가 엉뚱한
        지역을 열므로, **기존 장소 검색 경로(`/places`)를 기본 필터 그대로** 연다.
        BE 가 상세에 `sigunguCode` 를 주면 그때 `parsePlaceFilters` 의 키로 좁힌다.
      */}
      <Link
        href="/places"
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center self-start rounded-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {messages.place.detailCongestionEmptyAction}
      </Link>
    </div>
  )
}

/**
 * 빈 상태 블록 (#708 의 상자를 #731 이 이어받았다).
 *
 * **`LeastCrowded` 줄과 같은 면·같은 곡률·같은 여백이다** — 정상 갈래에서 요약이 서던
 * 자리를 그대로 받으므로, 갈래가 달라도 카드의 골격이 흔들리지 않는다.
 *
 * **채움은 `--band` 다.** #731 은 `--bg-sunken` 을 지정했지만 그 토큰은 **바닥(L0) 전용**
 * 이고 소유자는 `Canvas` 다 (DESIGN.md §0 · §2-1). `styles/token-usage.test.ts` 가 그것을
 * 실제로 잠그고 있고, 그 예외 목록은 _"늘리지 않는다"_ 고 못박혀 있다 — 카드 안 아이템이
 * 회색 바닥색을 직접 칠하면 어느 층이 바닥인지 읽히지 않는다. 카드 안 아이템 채움으로
 * 이 시스템이 정해 둔 색은 `--band` 하나다.
 *
 * **#708 이 `--band` 를 기각했던 이유는 이 갈래에 더는 해당하지 않는다.** 그때 문제는
 * *"같은 카드 안에서 `--band` 가 이미 `LeastCrowded` 의 면"* 이라 한 색이 두 뜻을 갖는다는
 * 것이었는데, 그 상자는 **차트를 덮고 서 있었다.** 지금은 두 블록이 **배타적**이다 —
 * 한 화면에 같이 서지 않으므로 색이 뜻을 겸하지 않고, 오히려 같은 면이 "여기가 그 자리"
 * 라고 말한다. 구별은 색이 아니라 **문구**가 한다.
 *
 * **테두리를 걷었다.** `--border-strong` 은 veil 합성면 위에서 변이 사라지지 않게 고른
 * 값이었고(#708), 가릴 격자가 없어지면서 그 근거가 사라졌다. 테두리를 남기면 L2 가 L1 의
 * 채널(면 + 1px 테두리)을 쓰게 되어 두 층이 함께 죽는다 (DESIGN.md §0). `--band`(`#EEF0F3`)
 * 는 카드 면(`#FFFFFF`)과 1.14:1 이라 채움만으로 선다 — `LeastCrowded` 가 같은 값으로
 * 테두리 없이 서 있는 것과 같다.
 *
 * **가운데 정렬(`text-center`)과 `max-w-xs` 도 걷었다.** 둘 다 veil 한가운데 뜨는 상자의
 * 사정이었다 — 30일 레일 폭(1254) 때문에 폭을 묶었고, 덮개 가운데라 가운데 정렬이었다.
 * 좌측 정렬이 이 저장소의 빈 상태 규칙이고(`EmptyState` — _"가운데 정렬 + 큰 제목은 빈
 * 상태를 사건처럼 보이게 한다"_), 폭은 카드가 준다.
 *
 * **그림자를 얹지 않는다** — 카드 안에 눕는 면이다 (DESIGN.md §0 · §6).
 */
const EMPTY_BLOCK = 'bg-band flex flex-col items-start gap-1 rounded-md p-3'

/*
  **veil(`bg-bg/70`)을 걷었다** (#731).

  #670 이 그 알파를 고른 근거는 전부 "점선 격자를 어느 정도로 가릴 것인가" 였다 — 문구가
  점선 위에서 읽히는 하한, 점선이 질감으로 남는 상한, 그리고 #708 뒤에는 상자 테두리가
  합성면 위에서 묻히지 않는 하한. **가릴 격자가 사라졌으므로 그 계산 전체의 전제가 없다.**
  알파를 새로 고르는 대신 겹 자체를 없앴다.

  되살리려면 먼저 "차트를 왜 다시 그리는가" 에 답해야 한다 — 알파는 그 다음 문제다.
*/

/**
 * 서버가 고른 날. **`null` 이면 아무것도 그리지 않는다.**
 *
 * 면은 중립(`--band`)이다. 등급 tint 로 칠하면 이 줄이 언제나 초록이 되는데, 기간이 전부
 * 붐비는 주라면 **가장 덜 붐비는 날도 `HIGH`** 다 — 그때 초록 면은 없는 한산함을 말한다.
 * 등급은 배지가 서버 `name` 그대로 말하고, 면은 자리만 만든다.
 */
function LeastCrowded({
  item,
  items,
}: {
  item: DailyCongestionItem | null
  /** 같은 기간 전체 — 평균을 내는 데만 쓴다 (#651) */
  items: DailyCongestionItem[]
}) {
  if (item === null) return null

  const parts = splitDay(item.date)
  if (parts === null) return null

  return (
    <div className="bg-band flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md p-3">
      <span className="text-caption text-fg-muted font-semibold">
        {messages.place.detailCongestionLeastLabel}
      </span>
      <span className="text-title-2 text-fg font-bold tabular-nums">
        {messages.place.detailCongestionLeastDay
          .replace('{month}', parts.month)
          .replace('{day}', parts.day)
          .replace('{weekday}', parts.weekday)}
      </span>
      {/*
        **배지는 막대와 다른 축을 쓴다** (#603). 배지는 등급 이름(`한산`·`보통`·`혼잡`)을
        글자로 말하므로 색이 그 글자를 따라야 한다. 막대는 `HIGH` 안을 집중률로 한 번 더
        가르지만(`congestionFill`) 그 넷째 칸에는 대응하는 이름이 없다 — 배지에 같은 램프를
        쓰면 `혼잡` 이라 적힌 배지가 두 가지 색으로 뜬다.
      */}
      <MetricBadge
        tone={congestionTone(item.level.code)}
        size="sm"
        axis="congestion"
        className="ml-auto"
      >
        {item.level.name}
      </MetricBadge>
      {/*
        **숫자는 이 줄에만 적는다.** 막대마다 집중률을 적으면 카드가 표가 되고, 막대 길이가
        이미 비교를 해 준다. 서버가 고른 날에만 근거가 되는 수치를 붙인다.
      */}
      {item.concentrationRate !== null && (
        <RateLine concentrationRate={item.concentrationRate} items={items} />
      )}
    </div>
  )
}

/**
 * 집중률 줄 — 정수 + 같은 기간 평균과의 차이 (#651 · 진단 D-3).
 *
 * **`57.77` 만으로는 높은지 낮은지 알 수 없었다.** 화면 어디에도 비교 기준이 없었고,
 * 수월봉 30일 실측에서 그 값은 **평균보다 25 낮은 날**이었다. 비교할 것이 없으면
 * (아는 날 1일, 또는 전부 같은 값) 숫자만 낸다 — "평균보다 0 낮아요" 는 말이 아니다.
 *
 * **`30일 중 가장 한산` 이라 쓰지 않는다.** 기간은 7일일 수도 있고, 전부 붐비는 주라면
 * 가장 덜 붐비는 날도 `혼잡` 이다 — 등급은 옆 배지가 계속 말한다.
 */
function RateLine({
  concentrationRate,
  items,
}: {
  concentrationRate: number
  items: DailyCongestionItem[]
}) {
  const { rate, average, belowAverage } = congestionRateSummary(concentrationRate, items)

  return (
    <span className="text-caption text-fg-muted w-full font-medium tabular-nums">
      {messages.place.detailCongestionRateLabel} {rate}
      {average !== null &&
        belowAverage !== null &&
        ` ${messages.place.detailCongestionRateCompare
          .replace('{average}', String(average))
          .replace('{below}', String(belowAverage))}`}
    </span>
  )
}

/**
 * 날짜 축 막대.
 *
 * **두 기간이 같은 칸 폭을 쓴다** (#603). 예전에는 7일이 `flex-1` 로 남는 폭을 나눠 가졌다 —
 * 976px 본문 열에서 한 칸이 130px 이 되어 **막대가 트랙 높이보다 넓었고**, 그러면 높이
 * 차이가 면적 차이에 묻혀 "어느 날이 덜 붐비나" 가 눈으로 안 읽혔다. 폭을 고정해 왼쪽으로
 * 붙이고 오른쪽을 비운다 — 빈 자리는 읽을 수 없는 그래프보다 낫다.
 *
 * 30일은 그 폭 그대로 넘치는 만큼 구른다. 두 기간의 막대가 같은 폭·같은 트랙이라 펼쳐도
 * 그림이 튀지 않는다.
 */
function Chart({
  items,
  pickedDate,
  days,
}: {
  items: DailyCongestionItem[]
  /** 서버가 고른 날. 그 칸에 표시를 준다 */
  pickedDate: string | null
  days: CongestionDays
}) {
  /*
    **훅이 이른 반환보다 위다.** 아래 `items.length === 0` 이 걸리는 장소가 생기면 순서가
    뒤집힌 순간 그 장소를 열 때마다 훅 개수가 달라진다 — 조건부 훅이다.
  */
  const rail = useScrollRail<HTMLUListElement>()

  /*
    **방어로 남긴다.** 전부 `UNKNOWN` 인 장소(날짜 목록이 빈 갈래 포함)는 이제 `PanelBody`
    가 위에서 걸러 여기까지 오지 않는다 (#731). 그래도 `leastCrowded` 가 실물인데
    `dailyCongestions` 가 비어 오는 조합을 타입이 막지 못하므로, 빈 `ul` 과 화살표만 남는
    카드를 만들지 않는다.
  */
  if (items.length === 0) return null

  const isMonth = days === CONGESTION_DAYS.month

  return (
    /*
      **`.scroll-rail` 은 화살표의 기준면이자 넘침 차단막이다** (`app/globals.css`).
      `position: relative` 가 화살표를 앉히고 `contain: layout` 이 전파를 끊는다 — 칸마다
      붙는 `sr-only` 라벨이 `position: absolute` 라, 기준면이 없으면 그 30개의 정적 위치가
      조상의 `scrollWidth` 로 새어 390 에서 페이지가 통째로 가로로 넘쳤다.
    */
    <div className={cn('relative', isMonth && 'scroll-rail')}>
      <ul
        ref={rail.ref}
        onScroll={rail.onScroll}
        className={cn(
          /*
            **`overflow-x: auto` 는 세로도 클립한다** — `overflow-y` 가 `visible` 로 남지 못하고
            함께 `auto` 가 되기 때문이다. 30일 막대 윗부분이 잘리던 원인이 이것이었다: 트랙에
            `outline-offset-2` 선택 표시가 있어 트랙 상자 **밖 위쪽 4px** 에 그려졌는데, 트랙이
            스크롤러 맨 위에 붙어 있어 그 4px 가 잘렸다.

            그 표시를 진한 파랑 채움으로 바꾸면서(#603) 트랙 밖에 그리는 것이 하나도 없어져
            여백이 필요 없어졌다 — 실측 `scrollHeight === clientHeight`. **다시 트랙 밖에
            무언가를 그리면(테두리·포커스 링) 그만큼 세로 여백을 함께 줘야 한다.**
          */
          'flex items-end gap-1.5',
          isMonth && 'overflow-x-auto',
          /*
            **넘치는 쪽만 카드 끝까지 연다** (`INSET_BLEED_END_CLASS.card`). 인셋 안에서
            자르면 마지막 칸이 여백 앞에서 끊겨 **깨진 막대**로 보인다 — 더 있다는 신호가
            아니라 렌더 오류처럼 읽힌다. 왼쪽은 그대로 둔다: 기간의 시작이라 잘릴 것이 없다.

            `rail` 의 음수 마진을 쓰면 카드 테두리를 뚫는다 (`lib/ui/inset.ts`).
          */
          isMonth && INSET_BLEED_END_CLASS.card,
          /*
            스크롤바를 숨기고 **페이드와 화살표가 그 신호를 대신한다** — 홈 골든타임 곡선과
            같은 장치다(`walk-times-section.tsx`). 상시 스크롤바는 활성 밑줄·진행 표시줄로
            오독된다(`app/globals.css`).
          */
          isMonth && 'scrollbar-none',
          isMonth && rail.fadeClassName,
        )}
      >
        {items.map((item) => (
          <DayColumn key={item.date} item={item} picked={item.date === pickedDate} />
        ))}
      </ul>

      {/* 갈 수 있는 쪽에만 뜬다 — 나타나고 사라지는 것 자체가 "여기가 끝" 이라는 신호다 */}
      {isMonth && (
        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.place.detailCongestionPrevDays}
          nextLabel={messages.place.detailCongestionNextDays}
        />
      )}
    </div>
  )
}

/**
 * 트랙 높이 = 집중률 100. 기간 안 최댓값으로 정규화하지 않는다 (`lib/insight/congestion.ts`).
 *
 * **96 에서 144 로 올렸다** (#603). 칸 폭을 36 으로 줄인 것만으로는 부족했다 — 축이 0~100
 * 고정이라 실데이터가 60~90 에 몰리면 막대 끝이 트랙 위쪽 30% 안에서만 움직이고, 96px
 * 트랙에서 그 구간은 29px 다. 144 면 43px 이 되어 같은 차이가 눈에 걸린다.
 */
const TRACK_HEIGHT = 'h-36'

/** 칸 폭 — 7일·30일이 같이 쓴다. 날짜(`21월`)가 접히지 않는 최소치다 */
const COLUMN_WIDTH = 'w-9'

/**
 * 막대 색 — **두 값뿐이다** (#603).
 *
 * **등급으로 칠하지 않는다.** 막대 높이가 이미 집중률이고 서버 등급도 그 집중률에서
 * 갈리므로, 색으로 등급을 그리면 **같은 변수를 두 번** 그린다 — 색을 아무리 나눠도 새로
 * 알려 주는 것이 없고, 실제로 30일을 펼치면 한 등급에 몰려 한 덩어리로 깔렸다.
 *
 * 그래서 색은 **"이 날이 답" 하나만** 말한다. 등급은 카드 머리 배지와 `sr-only` 가 계속
 * 글자로 말하므로 잃는 정보가 없다.
 *
 * `--metric-critical-*` 을 붐비는 날에 쓰지 않는 이유도 여기 있다 — 붐비는 날은 위험한
 * 날이 아니라 사람 많은 날이다 (DESIGN.md §2-3 의 "`LOW` 에 danger 를 쓰지 않는다").
 */
const BAR_FILL = 'bg-congestion-bar'
const BEST_FILL = 'bg-congestion-best'

function DayColumn({ item, picked }: { item: DailyCongestionItem; picked: boolean }) {
  const parts = splitDay(item.date)
  const rate = item.concentrationRate

  return (
    <li
      // 7일도 30일도 같은 폭이다 — 남는 폭을 나눠 갖지 않는다 (`Chart` 머리주석)
      className={cn('flex shrink-0 flex-col items-center gap-1.5', COLUMN_WIDTH)}
    >
      <div
        className={cn(
          'flex w-full items-end rounded-sm',
          TRACK_HEIGHT,
          /*
            **`UNKNOWN` 은 빈칸도 짧은 막대도 아니다** — 둘 다 "한산하다" 로 읽힌다.
            트랙 전체를 점선으로 두고 막대를 그리지 않는다. `--metric-unknown-500` 이
            점선 테두리 전용인 이유가 정확히 이것이다 (DESIGN.md §2-3).

            **아는 날의 `bg-band` 트랙을 지우지 않는다** (#651 · 세부명세 D8). UI/UX 진단
            D-3 이 "회색 잔여 영역은 지우고 막대 높이만" 을 제안했지만 따르지 않았다 —
            진단 문서와 인계 문서가 살아 있으니 그것만 읽고 이 파일을 열면 지우게 된다.

            근거 셋: ① 이 회색이 **0~100 축**이다(`barHeightPercent` 가 기간 최댓값으로
            정규화하지 않는다). 지우면 `58` 이 무엇에 대한 58 인지 사라진다. ② 실데이터가
            좁은 구간에 몰린다 — 수월봉 30일은 57.77~88.18 이라 기준면이 없으면 막대들이
            전부 꽉 찬 것처럼 보인다. ③ **바로 위 `UNKNOWN` 점선 상자가 트랙 전체 높이다**
            — 아는 날의 트랙만 없애면 그 상자가 화면에서 유일한 전체 높이 요소가 되어
            **가장 붐비는 날처럼 읽힌다.**

            진단이 말한 문제(회색의 뜻을 모르겠다)는 `RateLine` 의 상대 표현이 글자로 푼다.
          */
          rate === null ? 'border-metric-unknown-500 border-2 border-dashed' : 'bg-band',
        )}
      >
        {rate !== null && (
          /*
            **서버가 고른 날을 색으로 말한다** (#603). 예전에는 트랙에 `--brand-500` 테두리를
            둘렀는데, 진한 파랑이 그 역할을 하게 되면서 같은 것을 두 번 말하게 됐다 — 신호가
            둘이면 어느 쪽이 답인지 흐려진다.

            **색이 유일한 채널은 아니다.** 위의 `LeastCrowded` 가 그 날짜를 글자로 말하고,
            아래 `sr-only` 가 등급과 집중률을 읽는다.
          */
          <div
            className={cn('w-full rounded-sm', picked ? BEST_FILL : BAR_FILL)}
            style={{ height: `${barHeightPercent(rate)}%` }}
          />
        )}
      </div>

      {parts !== null && (
        <span className="text-caption text-fg-muted font-medium tabular-nums">
          {/*
            **초록을 남기지 않는다** (#603). 예전에는 선택 표시가 `--brand-500` 테두리였고
            이 숫자가 그 짝인 `--brand-700` 이었다. 테두리를 진한 파랑으로 갈아탄 지금 이
            숫자만 초록으로 남으면 한 칸에 색이 셋이 된다 — 강조는 굵기가 진다.
          */}
          <span className="text-fg font-semibold">{parts.day}</span>
          {parts.weekday}
        </span>
      )}

      {/*
        막대의 높이와 색은 스크린리더에 아무 말도 하지 못한다. 등급은 서버 `name` 을 그대로
        읽어 준다 — `UNKNOWN` 도 "정보 없음" 이라는 이름을 갖고 있어 따로 문구를 만들지 않는다.

        **집중률까지 읽는다** (#603). 이 카드에서 실제로 비교를 해 주는 것은 **막대 높이**인데
        (색은 답인 하루만 말한다), 높이는 스크린리더에 아무것도 전하지 못한다. 등급 이름만
        읽으면 같은 `혼잡` 안의 68 과 92 가 한 낱말로 뭉뚱그려진다 — 눈으로는 갈리는 차이가
        보조기기에서만 사라진다.
      */}
      <span className="sr-only">
        {parts === null
          ? item.date
          : messages.place.detailCongestionBar
              .replace('{month}', parts.month)
              .replace('{day}', parts.day)
              .replace('{weekday}', parts.weekday)}{' '}
        {item.level.name}
        {/* 눈으로 보는 값과 갈리지 않게 **여기도 정수다** (#651) — 예전에는 `79` 와 `87.42` 가 섞였다 */}
        {rate !== null && ` ${messages.place.detailCongestionRateLabel} ${Math.round(rate)}`}
      </span>
    </li>
  )
}

/**
 * 7일 ↔ 30일.
 *
 * **URL 에 두지 않는다.** 필터·정렬·탭은 `searchParams` 가 갖지만(architecture-guide §10)
 * 이것은 한 카드 안에서 끝나는 **펼침**이다 — `/places/{id}` 링크를 공유했을 때 상대가
 * 봐야 하는 것은 그 장소이지 내가 펼쳐 둔 기간이 아니다.
 */
function DaysToggle({
  days,
  onDaysChange,
}: {
  days: CongestionDays
  onDaysChange: (days: CongestionDays) => void
}) {
  const isMonth = days === CONGESTION_DAYS.month

  return (
    <button
      type="button"
      onClick={() => onDaysChange(isMonth ? CONGESTION_DAYS.week : CONGESTION_DAYS.month)}
      // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
      className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center self-start font-semibold focus-visible:ring-2 focus-visible:outline-none"
    >
      {isMonth ? messages.place.detailCongestionCollapse : messages.place.detailCongestionExpand}
    </button>
  )
}

/** 실제 콘텐츠와 크기를 맞춰 레이아웃 점프를 막는다 (coding-conventions.md §6) */
function BodySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton variant="text" className="h-14 w-full rounded-md" />
      {/*
        **기본이 30일이라 스켈레톤도 레일 모양이다** (#603). 7칸 그리드였을 때는 로딩이
        끝나는 순간 7칸이 30칸 레일로 바뀌어 카드가 한 번 출렁였다.

        칸 수를 폭에 맞춰 세지 않는다 — 넘치는 만큼 `overflow-hidden` 이 자른다. 실제
        레일도 같은 자리에서 잘려 보이므로(구를 수 있다는 신호는 화살표가 낸다) 로딩과
        본화면의 실루엣이 맞는다. `aria-hidden` 이라 칸 수가 보조기기에 새지 않는다.
      */}
      <div aria-hidden className="flex gap-1.5 overflow-hidden">
        {Array.from({ length: CONGESTION_DAYS.month }, (_, slot) => (
          <Skeleton
            key={slot}
            variant="text"
            className={cn('shrink-0 rounded-sm', COLUMN_WIDTH, TRACK_HEIGHT)}
          />
        ))}
      </div>
    </div>
  )
}
