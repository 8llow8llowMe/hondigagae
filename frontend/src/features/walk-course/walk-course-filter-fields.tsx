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
 *
 * ### 정렬은 여전히 세그먼트다 (#734)
 *
 * 이슈 #734 는 정렬을 세그먼트에서 빼 **결과 줄 옆의 텍스트 드롭다운**으로 내리라고
 * 했지만, "기존 컴포넌트를 재사용한다 — 저장소에 맞는 것이 없으면 새로 만들지 말라" 는
 * 전제가 함께 있다. 저장소를 훑은 결론:
 *
 * - `src/components/menu.tsx`(`Menu`) — **이동 또는 동작** 팝오버다(자기 문서 주석).
 *   항목에 "지금 선택된 값" 개념이 없어(`MenuItem` 에 `selected` 필드가 없다), 트리거
 *   라벨을 손으로 동기화하는 것 말고는 값-선택 드롭다운 역할을 흉내낼 수 없다.
 * - `features/nav/pet-switcher.tsx` 가 유일하게 "트리거가 현재 값을 보여주는" 드롭다운
 *   모양이지만, **공용 컴포넌트가 아니라 그 화면 전용으로 직접 그린 팝오버**다
 *   (`useOverlay` 배선 · `role="menuitemradio"` · 바깥 클릭 처리를 전부 새로 쓴다).
 *
 * 즉 "재사용할 수 있는 값-선택 드롭다운"은 저장소에 없고, 그것을 새로 만드는 것은 이
 * 이슈가 스스로 범위 밖이라고 못박았다. 그래서 세그먼트 자체는 유지하고, 두 축이 서로
 * 다른 질문이라는 것을 **보이는 라벨**(12px/600/`--fg-muted`)과 **그룹 간격 24 이상**으로
 * 말한다 — `FieldGroup` 이 그 자리다.
 */
function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {/*
        라디오그룹의 접근 이름(`Segment` 의 `aria-label`)이 이미 축을 말하므로, 이
        캡션은 시각 전용이다 — 겹쳐 읽히지 않게 `aria-hidden` 을 단다.
      */}
      <span aria-hidden className="text-caption text-fg-muted font-semibold">
        {label}
      </span>
      {children}
    </div>
  )
}

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
    <FieldGroup label={messages.walkCourse.activityFieldLabel}>
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
            {messages.walkCourse.activityWithin.replace(
              '{hours}',
              String(ACTIVITY_MAX_HOURS[code]),
            )}
          </SegmentOption>
        ))}
      </Segment>
    </FieldGroup>
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
    <FieldGroup label={messages.walkCourse.sortGroupLabel}>
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
    </FieldGroup>
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
