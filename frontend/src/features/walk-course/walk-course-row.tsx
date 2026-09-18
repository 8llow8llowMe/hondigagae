import Image from 'next/image'
import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { formatCourseDistance } from '@/lib/format/distance'
import { imageSrc } from '@/lib/image/remote-host'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
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
 */
export function WalkCourseRow({
  course,
  inset = 'card',
}: {
  course: WalkCourseSummary
  inset?: Inset
}) {
  const thumbnail = imageSrc(course.firstImage)

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
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        className="focus-visible:ring-brand-500 flex min-h-11 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:py-4"
      >
        {/*
          **이미지가 있을 때만 선행 열이 생긴다.** 없는 행에 회색 사각형을 두지 않는다 —
          25행이 같은 회색이면 그것은 정보가 아니라 잡음이다 (D1-1).

          `alt` 는 빈 문자열이다 — 바로 옆에 이름표가 글자로 있다 (D6).
        */}
        {thumbnail !== null && (
          <div className="bg-band relative size-16 shrink-0 overflow-hidden rounded-md md:size-20">
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="(min-width: 768px) 80px, 64px"
              className="object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {/* `3코스 (A)` 의 괄호가 다음 줄로 떨어지지 않게 한 덩어리로 둔다 (D1) */}
            <span className="text-body-1 text-fg font-semibold whitespace-nowrap">
              {course.courseLabel}
            </span>
            <span className="text-body-1 text-fg min-w-0 font-medium break-keep">
              {course.name}
            </span>
          </p>

          {/* 단위를 드러낸다 — `docs/coding-conventions.md` §7 */}
          <p className="text-body-2 text-fg-muted mt-1 tabular-nums">
            {formatCourseDistance(course.distanceKm)} · {course.durationText}
          </p>

          {/*
            **원문 그대로 렌더한다** (D4-4). `제주민속촌주차장 입구-남원포구` 처럼 공백과
            하이픈이 섞여 있고 시설명 안에도 하이픈이 들어올 수 있어, 갈라 재조립하면
            잘못 갈리는 코스가 생긴다.
          */}
          <p className="text-caption text-fg-subtle mt-1 break-keep">{course.startEndPoint}</p>
        </div>

        {/* 눌러서 이동한다는 것을 말하는 유일한 신호다 */}
        <ChevronRightIcon size={20} aria-hidden className="text-fg-subtle shrink-0" />
      </Link>
    </li>
  )
}
