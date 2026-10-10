'use client'

import { type Ref, useEffect, useRef, useState } from 'react'

import { ChevronRightIcon } from '@/components/icons'
import {
  type CalendarDirection,
  monthCells,
  monthLabel,
  shiftMonth,
  stepDay,
  type YearMonth,
  yearMonthOf,
} from '@/lib/date/calendar'
import { isDayWithin, weekdayOf, WEEKDAYS } from '@/lib/date/day'
import { cn } from '@/lib/utils/cn'

/**
 * 달 격자 — 날짜 하나를 고른다.
 *
 * **`<input type="date">` 를 대체한다.** 네이티브 날짜 입력은 브라우저마다 생김새와
 * 조작이 다르고(크롬은 아이콘, 사파리는 스텝퍼), 여행 기간처럼 **두 날짜의 관계**를
 * 보여줄 방법이 없다. 여기서는 고른 기간이 격자에 띠로 남는다.
 *
 * **날짜 계산을 갖지 않는다.** 격자·이동은 `lib/date/calendar.ts` 가, 문자열 규칙은
 * `lib/date/day.ts` 가 소유한다 — 이 파일은 그리기와 포커스만 맡는다.
 *
 * 키보드는 **roving tabindex** 다. 42칸을 모두 탭 정지로 두면 달력 하나를 지나가는 데
 * 탭을 42번 눌러야 한다 — 격자 전체가 하나의 정지이고 그 안은 방향키로 움직인다.
 */
export function Calendar({
  /** 선택된 날짜(`'YYYY-MM-DD'`). 없으면 빈 문자열 */
  value,
  onSelect,
  /** 이 날짜보다 이르면 고를 수 없다. 경계는 포함이다 */
  min = null,
  max = null,
  /** 오늘 표시(`aria-current="date"`). 주입받는다 — 모듈에서 `new Date()` 를 부르지 않는다 */
  today,
  /**
   * 이미 고른 기간. 격자에 띠로 남겨 **지금 고르는 날짜가 그 기간의 어디인지** 보이게 한다.
   * 시작일 달력에서도 종료일이 보여야 "3일" 이 왜 3일인지 그 자리에서 이해된다.
   */
  rangeStart = null,
  rangeEnd = null,
  focusRef,
  className,
}: {
  value: string
  onSelect: (date: string) => void
  min?: string | null
  max?: string | null
  today: string
  rangeStart?: string | null
  rangeEnd?: string | null
  /**
   * 격자의 **탭 정지 칸**. 달력이 열릴 때 첫 초점을 여기로 보내려고 사용처가 붙인다.
   *
   * 이것이 없으면 `useOverlay` 가 패널의 첫 포커스 가능 요소(`이전 달` 버튼)를 잡는다 —
   * 열자마자 하려는 일은 날짜를 고르는 것이지 달을 넘기는 것이 아니다.
   */
  focusRef?: Ref<HTMLButtonElement>
  className?: string
}) {
  /*
    **값이 없을 때 어느 날에서 시작할지.** 예전에는 무조건 오늘이었는데, 종료일 달력은
    열릴 때 값이 비어 있고 `min`(=시작일)만 갖는다 — 시작일이 몇 달 뒤면 오늘의 달이
    열리고 **화면 전체가 비활성**이라 고를 것이 하나도 없었다. 첫 초점도 비활성 칸으로
    가서 아무 데도 닿지 않았다.
  */
  const anchorDay = value !== '' ? value : min !== null && today < min ? min : today

  /** 보고 있는 달 */
  const [visible, setVisible] = useState<YearMonth>(
    () => yearMonthOf(anchorDay) ?? yearMonthOf(today) ?? { year: 2026, month: 1 },
  )

  /**
   * 격자 안에서 포커스를 갖는 칸. **선택값과 다른 축이다** — 방향키로 훑는 동안에는
   * 아직 고르지 않았다. 값이 밖에서 바뀌면(칩·다른 필드) 따라간다.
   */
  const [focused, setFocused] = useState(() => anchorDay)
  /**
   * 커서가 얹힌 칸. **구간 미리보기 전용이다** — 값도 포커스도 아니다.
   * 격자를 벗어나면 `null` 로 돌아간다.
   */
  const [hovered, setHovered] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  /** 방향키 이동으로 옮긴 포커스만 DOM 에 반영한다 — 열릴 때 격자가 화면을 잡아채지 않게 */
  const movingRef = useRef(false)

  useEffect(() => {
    if (value === '') return
    setFocused(value)
    const ym = yearMonthOf(value)
    if (ym !== null) setVisible(ym)
  }, [value])

  useEffect(() => {
    if (!movingRef.current) return
    movingRef.current = false
    gridRef.current?.querySelector<HTMLElement>('[data-focused="true"]')?.focus()
  }, [focused])

  function move(direction: CalendarDirection) {
    const next = stepDay(focused, direction)
    movingRef.current = true
    setFocused(next)

    // 달을 벗어나면 그 달로 넘어간다 — 격자 끝에서 막히면 다음 달로 갈 방법이 없다
    const ym = yearMonthOf(next)
    if (ym !== null && (ym.year !== visible.year || ym.month !== visible.month)) setVisible(ym)
  }

  const cells = monthCells(visible)
  const rangeLow = rangeStart !== null && rangeStart !== '' ? rangeStart : null
  const rangeHigh = rangeEnd !== null && rangeEnd !== '' ? rangeEnd : null

  /*
    **끝이 아직 없으면 커서까지를 미리 칠한다.** 종료일 달력은 시작일만 들고 열리는데,
    어디까지 고르는 중인지 보이지 않으면 며칠 일정이 되는지 손을 떼기 전까지 알 수 없다.

    **마우스가 없어도 성립해야 한다.** 방향키로 훑는 사람에게도 같은 띠가 필요하므로
    커서가 없을 때는 포커스 칸을 끝으로 본다. 시작일보다 앞이면 구간이 아니라 칠하지 않는다.
  */
  const previewEnd = hovered ?? focused
  const high = rangeHigh ?? (rangeLow !== null && previewEnd >= rangeLow ? previewEnd : null)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/*
        **연 단위 이동을 함께 둔다** (#162). 달 버튼만 있으면 내년 여행을 잡는 데 12번을
        눌러야 한다. 연도 선택 드롭다운을 두지 않은 이유는 이 달력이 여행 날짜를 고르는
        자리이기 때문이다 — 실제 범위가 몇 달 앞이라 목록을 여는 조작이 더 비싸다.
      */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center">
          <MonthNavButton
            label="이전 해"
            onClick={() => setVisible(shiftMonth(visible, -MONTHS_IN_YEAR))}
            direction="prev"
            double
          />
          <MonthNavButton
            label="이전 달"
            onClick={() => setVisible(shiftMonth(visible, -1))}
            direction="prev"
          />
        </div>

        {/* 달을 넘길 때 이 문구가 바뀌는 것을 스크린리더가 알아야 한다 */}
        <p aria-live="polite" className="text-body-1 text-fg font-semibold tabular-nums">
          {monthLabel(visible)}
        </p>

        <div className="flex items-center">
          <MonthNavButton
            label="다음 달"
            onClick={() => setVisible(shiftMonth(visible, 1))}
            direction="next"
          />
          <MonthNavButton
            label="다음 해"
            onClick={() => setVisible(shiftMonth(visible, MONTHS_IN_YEAR))}
            direction="next"
            double
          />
        </div>
      </div>

      <div aria-hidden className="grid grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="text-caption text-fg-muted flex h-8 items-center justify-center font-medium"
          >
            {weekday}
          </span>
        ))}
      </div>

      {/*
        `role="grid"` 을 쓰지 않는다. 격자 role 은 행(`row`)·셀(`gridcell`) 구조를 함께
        요구하는데, 그것을 반만 붙이면 스크린리더가 표로 읽으려다 행 수를 못 세고
        아무 안내도 못 하는 상태가 된다. 각 칸이 날짜 전체를 이름으로 가진 버튼이면
        `group` 만으로도 "무엇을 누르는지" 가 정확히 전달된다.
      */}
      <div
        ref={gridRef}
        role="group"
        aria-label="날짜 선택"
        // 격자를 벗어나면 미리보기를 접는다 — 칸마다 걸면 칸 사이 여백에서 깜빡인다
        onMouseLeave={() => setHovered(null)}
        className="grid grid-cols-7"
      >
        {cells.map((cell) => {
          const selectable = isDayWithin(cell.date, min, max)
          const selected = cell.date === value
          const inRange =
            rangeLow !== null && high !== null && cell.date >= rangeLow && cell.date <= high
          /*
            **다른 필드가 정한 구간의 시작점.** 이 달력의 값은 아니므로 브랜드색으로
            칠하지 않는다 — 회색으로 "여기서부터" 만 말한다.
          */
          const isRangeStart = rangeLow !== null && cell.date === rangeLow && !selected

          return (
            <button
              key={cell.date}
              type="button"
              {...(cell.date === focused && focusRef !== undefined ? { ref: focusRef } : {})}
              // 격자 전체가 탭 정지 하나다. 안에서는 방향키로 움직인다
              tabIndex={cell.date === focused ? 0 : -1}
              data-focused={cell.date === focused}
              disabled={!selectable}
              aria-label={dayLabel(cell.date)}
              aria-pressed={selected}
              {...(cell.date === today ? { 'aria-current': 'date' as const } : {})}
              /*
                **방향키는 칸 자신이 듣는다.** 격자 wrapper 에 얹으면 역할 없는 요소가
                키보드 상호작용을 갖게 되고(스크린리더가 무엇을 조작하는지 말할 수
                없다), 실제로 포커스를 들고 있는 것은 언제나 이 버튼이다.
              */
              onKeyDown={(event) => {
                const direction = ARROW_KEYS[event.key]
                if (direction === undefined) return
                event.preventDefault()
                move(direction)
              }}
              onClick={() => {
                setFocused(cell.date)
                onSelect(cell.date)
              }}
              onMouseEnter={() => setHovered(cell.date)}
              className={cn(
                'text-body-2 relative flex h-11 items-center justify-center tabular-nums',
                'focus-visible:ring-brand-500 focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-35',
                // 기간 띠는 **선택 칸 아래 층**이다. 두 표시가 겹쳐도 어느 날짜를
                // 고른 것인지가 먼저 읽혀야 한다
                inRange && !selected && 'bg-band',
                selected
                  ? 'bg-brand-600 text-fg-inverse rounded-md font-bold'
                  : cell.inMonth
                    ? 'text-fg hover:bg-band font-medium'
                    : 'text-fg-subtle hover:bg-band',
                // 선택 칸(brand)보다 뒤에 온다 — `cn` 이 tailwind-merge 라 뒤가 이긴다
                isRangeStart && 'bg-border-strong text-fg rounded-md font-semibold',
              )}
            >
              {cell.dayOfMonth}
              {/* 오늘 표시. 색만으로 알리지 않으려 점을 쓴다 — 선택 칸에서도 보인다 */}
              {cell.date === today && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute bottom-1 size-1 rounded-full',
                    selected ? 'bg-fg-inverse' : 'bg-brand-600',
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ARROW_KEYS: Record<string, CalendarDirection | undefined> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

/** 한 해 = 12달. `shiftMonth` 가 delta 를 그대로 받으므로 연 이동도 같은 함수 하나다 */
const MONTHS_IN_YEAR = 12

/**
 * 달·해 이동 버튼.
 *
 * **연 이동은 화살표 두 개로 그린다.** 별도 아이콘을 들이지 않는다 — 겹친 화살표는
 * "한 번에 더 멀리" 라는 관습이 오래됐고, 접근 가능한 이름(`이전 해`)이 실제 의미를
 * 말하므로 아이콘이 혼자 뜻을 지지 않아도 된다.
 *
 * 44px 를 지킨다 (DESIGN.md §7). 넷이 나란히 서지만 가로 폭은 `size-9` 로 좁히고
 * 세로만 44를 채운다 — 좁은 화면에서 달 이름을 밀어내지 않기 위해서다.
 */
function MonthNavButton({
  label,
  onClick,
  direction,
  double = false,
}: {
  label: string
  onClick: () => void
  direction: 'prev' | 'next'
  /** 연 단위 이동 */
  double?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'text-fg-muted hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none',
        double ? 'w-9' : 'w-11',
      )}
    >
      <span
        aria-hidden
        className={cn('inline-flex', direction === 'prev' ? 'rotate-180' : undefined)}
      >
        <ChevronRightIcon size={20} />
        {/*
          두 번째 화살표를 겹쳐 "한 번에 더 멀리" 를 만든다. 겹침은 `-ms-3`(12) —
          예전 `-ms-3.5`(14) 는 스케일 밖 값이었고(§4), 두 글리프 사이가 6 → 8px 로
          2px 벌어질 뿐이라 `w-9`(36) 버튼 안에 그대로 들어간다.
        */}
        {double && <ChevronRightIcon size={20} className="-ms-3" />}
      </span>
    </button>
  )
}

/** `2026년 9월 12일 (토)` — 칸의 접근 가능한 이름. 숫자만 읽히면 무슨 날짜인지 모른다 */
export function dayLabel(date: string): string {
  const weekday = weekdayOf(date)
  const [year, month, day] = date.split('-')
  const base = `${year}년 ${Number(month)}월 ${Number(day)}일`
  return weekday === null ? base : `${base} (${weekday})`
}
