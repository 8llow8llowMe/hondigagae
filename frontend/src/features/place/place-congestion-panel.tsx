import { MetricBadge } from '@/components/metric'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { Skeleton } from '@/components/skeleton'
import {
  barHeightPercent,
  CONGESTION_DAYS,
  type CongestionDays,
  congestionRateSummary,
  formatCongestionRange,
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
  const range = data === null ? null : formatCongestionRange(data.fromDate, data.toDate)

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

  const hasUnknown = data.dailyCongestions.some((item) => item.concentrationRate === null)

  return (
    <>
      <LeastCrowded item={data.leastCrowded} items={data.dailyCongestions} />

      <Chart
        items={data.dailyCongestions}
        pickedDate={data.leastCrowded?.date ?? null}
        days={days}
      />

      {/*
        **`leastCrowded` 가 null 이면 전부 모르는 날이다** — 그때는 점선의 뜻을 설명하는
        대신 이 장소에 자료가 없다는 사실을 말한다. 404 가 아니라 빈 상태라 재시도를 달지
        않는다: 장소는 있고 연결된 관광지 통계가 없는 것이다.
      */}
      {data.leastCrowded === null ? (
        <div className="flex flex-col gap-1">
          <p className="text-body-2 text-fg font-semibold">
            {messages.place.detailCongestionEmptyTitle}
          </p>
          <p className="text-caption text-fg-muted">
            {messages.place.detailCongestionEmptyDescription}
          </p>
        </div>
      ) : (
        <>
          {hasUnknown && (
            <p className="text-caption text-fg-muted">
              {messages.place.detailCongestionUnknownNote}
            </p>
          )}
          {days === CONGESTION_DAYS.month && (
            <p className="text-caption text-fg-muted">
              {messages.place.detailCongestionExtendedNote}
            </p>
          )}

          <DaysToggle days={days} onDaysChange={onDaysChange} />
        </>
      )}
    </>
  )
}

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
      <MetricBadge tone={congestionTone(item.level.code)} size="sm" className="ml-auto">
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
    **훅이 이른 반환보다 위다.** 아래 `items.length === 0` 은 전부 `UNKNOWN` 인 장소에서
    실제로 걸리는 갈래라, 순서가 뒤집히면 그 장소를 열 때마다 훅 개수가 달라진다.
  */
  const rail = useScrollRail<HTMLUListElement>()

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
