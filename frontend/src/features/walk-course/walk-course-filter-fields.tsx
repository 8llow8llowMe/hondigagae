'use client'

import type { ReactNode } from 'react'

import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import { ACTIVITY_MAX_HOURS } from '@/lib/walk-course/activity'
import {
  WALK_COURSE_ACTIVITY_PARAMS,
  type WalkCourseActivityChoice,
  type WalkCourseActivityParam,
  type WalkCourseSort,
} from '@/types/walk-course'

/**
 * 코스 목록의 두 축 — **순수 컨트롤이다.** `onChange` 만 부르고 조회도 URL 도 만지지 않는다
 * (`emergency-filter-fields.tsx` 와 같은 자리의 모듈).
 *
 * **세그먼트 문법은 `EmergencyTypeSegment` 를 그대로 쓴다** (#537 · `코스목록-세부명세.md` D2):
 * 테두리 한 겹 + 칸 사이 `border-l`, 전폭 균등, `role="radiogroup"` + `aria-checked`.
 * 축이 배타라 칩이 아니라 세그먼트다 — 칩은 "켜고 끄는 것" 으로 먼저 읽힌다.
 *
 * **색만으로 선택을 표시하지 않는다** — 배경 + weight 600 + `aria-checked` 3중 (D6).
 */

/**
 * 걷는 시간.
 *
 * **`applied` 를 받는다 — URL 값이 아니다.** URL 이 비어 있으면 서버가 대표견으로 채우므로
 * (공통명세 S4-1), URL 만 보면 **실제로 4시간 이내로 좁혀진 화면에서 아무 칸도 선택돼
 * 있지 않다.** 컨트롤은 화면에 실제로 적용된 것을 가리켜야 한다.
 *
 * 그래서 `전체` 는 `applied === null` 일 때 선택되고, 누르면 URL 에 **`ALL` 을 명시한다** —
 * 값이 없는 상태로 되돌리면 대표견이 다시 채워 필터를 끌 수가 없다.
 */
export function WalkCourseActivityField({
  applied,
  onChange,
}: {
  applied: WalkCourseActivityParam | null
  onChange: (next: WalkCourseActivityChoice) => void
}) {
  return (
    <Segment label={messages.walkCourse.activityGroupLabel}>
      <SegmentOption selected={applied === null} onSelect={() => onChange('ALL')}>
        {messages.walkCourse.activityAll}
      </SegmentOption>
      {WALK_COURSE_ACTIVITY_PARAMS.map((code) => (
        <SegmentOption
          key={code}
          divider
          selected={applied === code}
          onSelect={() => onChange(code)}
        >
          {/* 상한 숫자는 `lib/walk-course/activity.ts` 한 곳이 갖는다 (D5-2) */}
          {messages.walkCourse.activityWithin.replace('{hours}', String(ACTIVITY_MAX_HOURS[code]))}
        </SegmentOption>
      ))}
    </Segment>
  )
}

/**
 * 정렬. **계약은 4종이지만 둘만 노출한다** (D8-4).
 *
 * `null` 이 서버 기본값 `COURSE_NO` 다 — 기본값은 URL 에 쓰지 않는다.
 */
export function WalkCourseSortField({
  sort,
  onChange,
}: {
  sort: WalkCourseSort | null
  onChange: (next: WalkCourseSort | null) => void
}) {
  return (
    <Segment label={messages.walkCourse.sortGroupLabel}>
      <SegmentOption selected={sort === null} onSelect={() => onChange(null)}>
        {messages.walkCourse.sortCourseNo}
      </SegmentOption>
      <SegmentOption
        divider
        selected={sort === 'DISTANCE_ASC'}
        onSelect={() => onChange('DISTANCE_ASC')}
      >
        {messages.walkCourse.sortDistanceAsc}
      </SegmentOption>
    </Segment>
  )
}

function Segment({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="border-border bg-bg flex w-full min-w-0 overflow-hidden rounded-md border"
    >
      {children}
    </div>
  )
}

function SegmentOption({
  selected,
  onSelect,
  divider = false,
  children,
}: {
  selected: boolean
  onSelect: () => void
  divider?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        'text-body-2 flex h-11 min-w-0 flex-1 items-center justify-center px-2 transition-colors',
        // 테두리가 바깥 한 겹이라 offset 을 주면 [테두리·흰틈·링] 세 겹이 된다
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:-outline-offset-2 focus-visible:outline-none',
        divider && 'border-border border-l',
        selected ? 'bg-band text-fg font-semibold' : 'text-fg-muted hover:bg-band font-medium',
      )}
    >
      <span className="truncate">{children}</span>
    </button>
  )
}
