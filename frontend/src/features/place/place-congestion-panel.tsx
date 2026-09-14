import { METRIC_FILL_TONE, MetricBadge } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import {
  barHeightPercent,
  CONGESTION_DAYS,
  type CongestionDays,
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
        <h2 id={CONGESTION_HEADING_ID} className="text-title-2 text-fg font-semibold break-keep">
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
      <LeastCrowded item={data.leastCrowded} />

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
          {days === CONGESTION_DAYS.extended && (
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
function LeastCrowded({ item }: { item: DailyCongestionItem | null }) {
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
      <MetricBadge tone={congestionTone(item.level.code)} size="sm" className="ml-auto">
        {item.level.name}
      </MetricBadge>
      {/*
        **숫자는 이 줄에만 적는다.** 막대마다 집중률을 적으면 카드가 표가 되고, 막대 길이가
        이미 비교를 해 준다. 서버가 고른 날에만 근거가 되는 수치를 붙인다.
      */}
      {item.concentrationRate !== null && (
        <span className="text-caption text-fg-muted w-full font-medium tabular-nums">
          {messages.place.detailCongestionRateLabel} {item.concentrationRate}
        </span>
      )}
    </div>
  )
}

/**
 * 날짜 축 막대.
 *
 * **7일은 남는 폭을 나눠 갖고, 30일은 가로 스크롤 레일이다.** 30칸을 폭에 맞춰 나누면
 * 한 칸이 10px 밑으로 내려가 날짜를 적을 자리가 없어진다 — **날짜 없는 막대는 고를 수
 * 없다.** 칸 폭을 고정(2rem)하고 넘치는 만큼 구르게 두면 두 기간이 같은 막대를 쓴다.
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
  if (items.length === 0) return null

  const extended = days === CONGESTION_DAYS.extended

  return (
    /*
      **넘치는 쪽만 카드 끝까지 연다** (`INSET_BLEED_END_CLASS.card`). 인셋 안에서 자르면
      마지막 칸이 여백 앞에서 끊겨 **깨진 막대**로 보인다 — 더 있다는 신호가 아니라 렌더
      오류처럼 읽힌다. 왼쪽은 그대로 둔다: 기간의 시작이라 잘릴 것이 없다.

      `rail` 의 음수 마진을 쓰면 카드 테두리를 뚫는다 (`lib/ui/inset.ts`).
    */
    <div className={cn(extended && 'overflow-x-auto', extended && INSET_BLEED_END_CLASS.card)}>
      <ul className={cn('flex items-end gap-1.5', extended && 'w-max')}>
        {items.map((item) => (
          <DayColumn
            key={item.date}
            item={item}
            picked={item.date === pickedDate}
            extended={extended}
          />
        ))}
      </ul>
    </div>
  )
}

/** 트랙 높이 = 집중률 100. 기간 안 최댓값으로 정규화하지 않는다 (`lib/insight/congestion.ts`) */
const TRACK_HEIGHT = 'h-24'

function DayColumn({
  item,
  picked,
  extended,
}: {
  item: DailyCongestionItem
  picked: boolean
  /** 30일은 칸 폭을 고정(32)하고 넘치는 만큼 구른다. 7일은 남는 폭을 나눠 갖는다 */
  extended: boolean
}) {
  const parts = splitDay(item.date)
  const rate = item.concentrationRate

  return (
    <li
      className={cn(
        'flex flex-col items-center gap-1.5',
        extended ? 'w-8 shrink-0' : 'min-w-0 flex-1',
      )}
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
          /*
            서버가 고른 날 표시. **등급 색이 아니라 선택 표시기다** (`--brand-500`,
            DESIGN.md §2) — 등급 색으로 두르면 붐비는 주의 최선일(`HIGH`)에 초록 테두리가
            생긴다. 색이 유일한 채널도 아니다: 위의 `LeastCrowded` 가 날짜를 글자로 말한다.
          */
          picked && 'outline-brand-500 outline-2 outline-offset-2',
        )}
      >
        {rate !== null && (
          <div
            className={cn('w-full rounded-sm', METRIC_FILL_TONE[congestionTone(item.level.code)])}
            style={{ height: `${barHeightPercent(rate)}%` }}
          />
        )}
      </div>

      {parts !== null && (
        <span className="text-caption text-fg-muted font-medium tabular-nums">
          <span className={cn('font-semibold', picked ? 'text-brand-700' : 'text-fg')}>
            {parts.day}
          </span>
          {parts.weekday}
        </span>
      )}

      {/*
        막대의 높이와 색은 스크린리더에 아무 말도 하지 못한다. 등급은 서버 `name` 을 그대로
        읽어 준다 — `UNKNOWN` 도 "정보 없음" 이라는 이름을 갖고 있어 따로 문구를 만들지 않는다.
      */}
      <span className="sr-only">
        {parts === null
          ? item.date
          : messages.place.detailCongestionBar
              .replace('{month}', parts.month)
              .replace('{day}', parts.day)
              .replace('{weekday}', parts.weekday)}{' '}
        {item.level.name}
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
  const extended = days === CONGESTION_DAYS.extended

  return (
    <button
      type="button"
      onClick={() => onDaysChange(extended ? CONGESTION_DAYS.default : CONGESTION_DAYS.extended)}
      // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
      className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center self-start font-semibold focus-visible:ring-2 focus-visible:outline-none"
    >
      {extended ? messages.place.detailCongestionCollapse : messages.place.detailCongestionExpand}
    </button>
  )
}

/** 실제 콘텐츠와 크기를 맞춰 레이아웃 점프를 막는다 (coding-conventions.md §6) */
function BodySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton variant="text" className="h-14 w-full rounded-md" />
      <div aria-hidden className="grid grid-cols-7 gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((slot) => (
          <Skeleton key={slot} variant="text" className={cn('w-full rounded-sm', TRACK_HEIGHT)} />
        ))}
      </div>
    </div>
  )
}
