'use client'

import type { ReactNode } from 'react'

import { messages } from '@/lib/messages'
import { handleRadioGroupKeyDown, radioTabIndex } from '@/lib/ui/radio-group-keys'
import { cn } from '@/lib/utils/cn'
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
 * 선택지 라벨 — **활동량 이름이다** (#735).
 *
 * 전에는 `4시간 이내`·`6시간 이내` 였고 그 숫자는 서버 상한(`WalkCourseActivityFit` 240·360분)
 * 의 FE 복제본이었다. 상한은 응답이 **적용된 하나만** 내려주므로(`appliedPetActivityLevel`)
 * 아직 고르지 않은 칸의 숫자는 화면이 알 길이 없다 — 복제본을 걷으면 이 라벨은 활동량
 * 이름으로 돌아온다. 그 대신 고른 뒤 **기준 줄**이 서버 상한을 말한다.
 *
 * 출처는 **반려견 등록 폼과 같은 목록**이다 (`messages.pet.options.activityLevel`,
 * `pet/공통명세.md` S6-1). enum 열거 API 가 없어 선택지 라벨만은 FE 가 갖는 자리이고
 * (`api-integration-guide.md` §6 "서버가 값을 주지 않는 컨트롤"), 표를 새로 만들지 않고
 * 이미 있는 그 하나를 쓴다 — 두 벌이면 BE 가 문구를 바꾼 날 화면마다 다른 말을 한다.
 */
const ACTIVITY_OPTIONS = WALK_COURSE_ACTIVITY_PARAMS.flatMap((code) => {
  const label = messages.pet.options.activityLevel.find((option) => option.code === code)?.name

  /*
    라벨을 못 찾은 칸은 **그리지 않는다.** `?? code` 로 떨어뜨리면 화면에 `LOW` 가 나간다 —
    `/emergency` 유형 칩이 정확히 그렇게 깨졌다 (#205 · `api-integration-guide.md` §6).
    두 목록 다 FE 상수라 실제로는 비지 않는다.
  */
  return label === undefined ? [] : [{ code, label }]
})

/**
 * 활동량.
 *
 * **`applied` 를 받는다 — URL 값이 아니다.** URL 이 비어 있으면 서버가 대표견으로 채우므로
 * (공통명세 S4-1), URL 만 보면 **실제로 좁혀진 화면에서 아무 칸도 선택돼 있지 않다.**
 * 컨트롤은 화면에 실제로 적용된 것을 가리켜야 한다.
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
    <FieldGroup label={messages.walkCourse.activityGroupLabel}>
      <Segment label={messages.walkCourse.activityGroupLabel}>
        <SegmentOption selected={applied === null} onSelect={() => onChange('ALL')}>
          {messages.walkCourse.activityAll}
        </SegmentOption>
        {ACTIVITY_OPTIONS.map(({ code, label }) => (
          <SegmentOption
            key={code}
            divider
            selected={applied === code}
            onSelect={() => onChange(code)}
          >
            {label}
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
      tabIndex={radioTabIndex(selected)}
      onKeyDown={handleRadioGroupKeyDown}
      onClick={onSelect}
      className={cn(
        // 높이 44 — 규칙이 아니라 이 자리에서 고른 값이다 (#883 이 §7 하한을 지도 타깃으로 좁혔다)
        'text-body-2 flex h-11 min-w-0 flex-1 items-center justify-center px-2 transition-colors',
        /*
          **데스크톱에서는 칸이 제 라벨 폭을 갖는다** (#818).

          `flex-1` 은 칸을 **균등 분할**한다. 모바일에서는 세그먼트가 전폭이라 그것이
          맞지만, `md:` 이상에서는 도구 줄(`md:flex-row`)이 이 그룹에 **콘텐츠 폭만**
          주므로 좁은 폭을 균등 분할하게 되고 **가장 긴 라벨부터 `truncate` 가 먹는다** —
          #798 이 `짧은 순`(40px) 을 `거리 짧은 순`(67px) 으로 늘리자 54px 칸에서 넘쳐
          `거리 짧…` 이 됐다. 오른쪽에 900px 넘는 빈 자리를 두고 잘렸다.

          `md:flex-none` 이 균등 분할을 끄고 `md:px-4` 가 칸 사이 숨을 준다. `truncate` 는
          그대로 둔다 — 안전망이지 레이아웃 수단이 아니다.
        */
        'md:flex-none md:px-4',
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
