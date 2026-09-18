import Image from 'next/image'
import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { formatCourseDistance } from '@/lib/format/distance'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { WalkCourseSummary } from '@/types/walk-course'

/**
 * 코스 한 줄 — **L1 카드 안의 L2 항목이다** (`DESIGN.md §0`).
 *
 * ### 사진 카드 그리드가 아니라 텍스트 행이다 (`코스목록-세부명세.md` D1-1)
 *
 * **이미지가 29개 중 4개만 있다** (실측 2026-09-18). 사진 카드를 쓰면 25장이 회색
 * 플레이스홀더이고 화면이 "데이터가 깨졌다" 로 읽힌다. `PlaceRow` 가 이미지 없는 행에도
 * 같은 크기의 타일을 남기는 것과 **반대로** 판단한 자리다 — 저쪽은 소수가 비어 행 높이가
 * 흔들리는 것이 문제이고, 여기는 **다수가 비어** 타일 자체가 잡음이 된다.
 *
 * 코스를 고르는 데 실제로 쓰는 값 셋(**이름표 · 거리 · 소요시간**)은 29개 모두 채워져 있다.
 *
 * **자기 테두리를 두르지 않는다** — 구분선은 `SurfaceList` 가 항목 사이에만 긋는다.
 *
 * **좌표 유무를 말하지 않는다** (D5-1). 좌표는 *골든타임을 이어 볼 수 있는가*만 정하는데,
 * 25행에 "날씨 정보 없음" 배지를 달면 코스를 고르는 축(거리·소요시간)과 무관한 사실이
 * 화면의 4/5를 덮는다. 그 사실은 필요해지는 자리 — 코스 상세 — 에서 한 줄로 말한다.
 *
 * ### 썸네일이 행 축을 밀지 않는다 (#734)
 *
 * **썸네일은 언제나 텍스트 다음, chevron 앞이다.** 예전에는 썸네일이 맨 앞이라 있는
 * 행만 제목이 76~92px 오른쪽으로 밀렸다 — 실측 29개 중 25개가 이미지 없는 분포에서는
 * 한 행만 축이 꺾이는 것으로 보였다. 이제 제목 블록(`min-w-0 flex-1`)이 항상 맨 앞이라,
 * 뒤에 오는 썸네일이 있고 없고는 **제목의 시작 위치에 아무 영향을 주지 않는다.**
 *
 * ### 1280 부터는 6칸 그리드다 (#734)
 *
 * `xl:`(1280) 부터 이 링크가 `.walk-course-row-grid`(`app/globals.css`)로 그리드가 된다 —
 * 코스 · 거리 · 소요시간 · 시종점 · 썸네일 · chevron 여섯 칸. **각 칸이 `xl:col-start-N`
 * 으로 자기 자리를 못박는다** — 플렉스였다면 썸네일이 없는 행에서 뒤 칸들이 당겨져
 * 칸마다 폭이 달라졌겠지만, 그리드 트랙은 자식 유무와 무관하게 항상 같은 폭이라
 * 썸네일 없는 행도 그 칸만 비고 시종점·chevron 은 그대로 선다.
 *
 * 1280 미만(모바일·태블릿)은 `xl:hidden` 으로 감춘 텍스트 블록 안에서 거리·소요시간·
 * 시종점을 이어 말한다 — `PlanRow` 의 상태 배지가 모바일/데스크톱에서 위치만 바꾸는 것과
 * 같은 자리에 같은 값을 두 번 두는 패턴이다. 열 머리는 `WalkCourseColumnHead` 가 그린다.
 */
export function WalkCourseRow({
  course,
  inset = 'card',
}: {
  course: WalkCourseSummary
  inset?: Inset
}) {
  const thumbnail = imageSrc(course.firstImage)
  const distance = formatCourseDistance(course.distanceKm)

  return (
    <li className={INSET_CLASS[inset]}>
      <Link
        href={`/walk-courses/${course.walkCourseId}`}
        /*
          **접근 이름은 `{courseLabel} {name}` 이다** (D6). 이름표만이면 `1코스` 가 29개라
          구분되지 않고, 구간명만이면 사용자가 아는 번호가 사라진다.

          거리·소요시간에 `aria-hidden` 을 붙이지 않는다 — 이름에는 없지만 행 안의
          텍스트로는 읽혀야 한다.
        */
        aria-label={`${course.courseLabel} ${course.name}`}
        className={cn(
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
          'focus-visible:ring-brand-500 flex min-h-11 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:py-4',
          // 1280 부터 6칸 그리드 — 그리드 트랙은 `.walk-course-row-grid` 가 정한다
          'walk-course-row-grid xl:grid xl:items-center xl:gap-5 xl:py-4',
        )}
      >
        {/* 코스 열 — 언제나 첫 칸이라 뒤에 오는 썸네일 유무와 무관하게 위치가 고정이다 */}
        <div className="min-w-0 flex-1 xl:col-start-1 xl:flex-none">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {/* `3코스 (A)` 의 괄호가 다음 줄로 떨어지지 않게 한 덩어리로 둔다 (D1) */}
            <span className="text-body-1 text-fg font-semibold whitespace-nowrap">
              {course.courseLabel}
            </span>
            <span className="text-body-1 text-fg min-w-0 font-medium break-keep">
              {course.name}
            </span>
          </p>

          {/*
            1280 미만 전용 — 거리·소요시간·시종점을 이 블록 안에서 이어 말한다.
            1280 이상은 각자 자기 열로 나가므로 여기서는 감춘다 (`xl:hidden`).
          */}
          <p className="text-body-2 text-fg-muted mt-1 tabular-nums xl:hidden">
            {distance} · {course.durationText}
          </p>
          {/*
            **원문 그대로 렌더한다** (D4-4). `제주민속촌주차장 입구-남원포구` 처럼 공백과
            하이픈이 섞여 있고 시설명 안에도 하이픈이 들어올 수 있어, 갈라 재조립하면
            잘못 갈리는 코스가 생긴다.
          */}
          <p className="text-caption text-fg-subtle mt-1 break-keep xl:hidden">
            {course.startEndPoint}
          </p>
        </div>

        {/* 거리 열 — 1280 이상 전용. 숫자라 오른쪽 정렬 + tabular-nums */}
        <p className="text-body-2 text-fg-muted hidden text-right tabular-nums xl:col-start-2 xl:block">
          {distance}
        </p>

        {/* 소요시간 열 — 1280 이상 전용 */}
        <p className="text-body-2 text-fg-muted hidden text-right tabular-nums xl:col-start-3 xl:block">
          {course.durationText}
        </p>

        {/*
          시종점 열 — 1280 이상 전용. 원문은 위와 같은 이유로 그대로 두되, 한 줄 표에서는
          `truncate` 로 한 줄을 지킨다 — 자르는 것은 표시일 뿐 원문을 갈라 재조립하지
          않으므로 D4-4 와 충돌하지 않는다. `title` 로 전체 문자열을 마우스 호버에 남긴다.
        */}
        <p
          title={course.startEndPoint}
          className="text-caption text-fg-subtle hidden min-w-0 truncate xl:col-start-4 xl:block"
        >
          {course.startEndPoint}
        </p>

        {/*
          썸네일 — **있을 때만 만든다.** 없는 행에 회색 사각형을 두지 않는다(D1-1) — 실측
          29개 중 25개가 이 경우다. `xl:col-start-5` 로 그리드 자리를 못박아, 이 칸이
          없어도 시종점(4)·chevron(6) 은 밀리지 않는다.

          `alt` 는 빈 문자열이다 — 바로 옆(1280 미만)이나 같은 행(1280 이상)에 이름표가
          글자로 있다 (D6).
        */}
        {thumbnail !== null && (
          <div className="bg-band relative size-16 shrink-0 overflow-hidden rounded-md md:size-20 xl:col-start-5">
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="(min-width: 1280px) 80px, (min-width: 768px) 80px, 64px"
              className="object-cover"
            />
          </div>
        )}

        {/* 눌러서 이동한다는 것을 말하는 유일한 신호다 */}
        <ChevronRightIcon
          size={20}
          aria-hidden
          className="text-fg-subtle shrink-0 xl:col-start-6"
        />
      </Link>
    </li>
  )
}

/**
 * 데스크톱(1280~) 전용 열 머리 — 코스 · 거리 · 소요시간 · 시종점.
 *
 * **행(`WalkCourseRow`)과 같은 그리드 템플릿(`.walk-course-row-grid`)을 공유한다.**
 * 한쪽만 고치면 라벨이 실제 값 위에서 어긋난다.
 *
 * **`aria-hidden` 이다.** 보조기기에는 새 정보가 아니다 — 각 행의 접근 이름(이름표+구간명)과
 * 행 안의 거리·소요시간·시종점 텍스트가 이미 같은 값을 전부 말한다. 열 머리는 **시각적으로
 * 훑는 사용자**를 위한 장치다.
 *
 * 썸네일·chevron 칸은 라벨이 없다 — 사진 유무를 표로 예고하지 않는다(D5-1 과 같은 이유로
 * "썸네일" 이라는 낱말도 보태지 않는다).
 */
export function WalkCourseColumnHead({ inset = 'card' }: { inset?: Inset }) {
  return (
    <div
      aria-hidden
      className={cn(
        'walk-course-row-grid hidden xl:grid xl:items-center xl:gap-5 xl:pb-2',
        INSET_CLASS[inset],
      )}
    >
      <span className="text-caption text-fg-muted font-semibold xl:col-start-1">
        {messages.walkCourse.columnCourseLabel}
      </span>
      <span className="text-caption text-fg-muted text-right font-semibold xl:col-start-2">
        {messages.walkCourse.distanceLabel}
      </span>
      <span className="text-caption text-fg-muted text-right font-semibold xl:col-start-3">
        {messages.walkCourse.durationLabel}
      </span>
      <span className="text-caption text-fg-muted font-semibold xl:col-start-4">
        {messages.walkCourse.startEndLabel}
      </span>
    </div>
  )
}
