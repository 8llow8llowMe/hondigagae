import Image from 'next/image'

import { formatCourseDistance } from '@/lib/format/distance'
import { imageSrc } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * 코스 상세의 머리 — **페이지 머리다. 카드에 담지 않는다**
 * (`DESIGN.md` §0 카드 판정 3문: 페이지 머리(h1)는 카드가 아니다).
 *
 * **`h1` 은 `courseLabel` 이다** (D6). 구간명은 그 아래 `<p>` — `1코스 시흥-광치기` 를
 * 한 `h1` 에 몰면 이름표와 구간명이 한 덩어리로 읽힌다.
 *
 * **훅을 쓰지 않는다** — node 환경에서 렌더해 단언할 수 있어야 한다
 * (`docs/testing-guide.md` §1).
 */
export function WalkCourseSummaryHeader({ course }: { course: WalkCourseDetail }) {
  const image = imageSrc(course.firstImage)

  return (
    <header className="flex flex-col gap-4">
      {/*
        **이미지는 있을 때만 붙는다** (D5). 실측 29개 중 25개가 이 모양이라, 자리를
        만들어 두면 대다수 화면의 첫 화면이 회색 사각형으로 시작한다.

        전폭 미디어는 카드가 아니다 (`DESIGN.md` §0) — `Surface` 로 감싸지 않는다.
        `alt` 는 빈 문자열이다: 바로 아래 이름표가 글자로 있다.
      */}
      {image !== null && (
        <div className="bg-band relative aspect-video w-full max-w-full overflow-hidden md:rounded-lg">
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className={cn('flex flex-col gap-3', INSET_CLASS.card)}>
        <div className="flex flex-col gap-1">
          {/* `15코스 (B)` 의 괄호가 다음 줄로 떨어지지 않게 한 덩어리로 둔다 (D1) */}
          <h1 className="text-title-1 text-fg font-bold whitespace-nowrap">{course.courseLabel}</h1>
          <p className="text-body-1 text-fg-muted break-keep">{course.name}</p>
        </div>

        {/*
         **핵심값 둘은 `<dl>` 이다** (D6). 라벨이 글자로 있어야 숫자만 읽히지 않는다.
         **단위는 라벨이 아니라 값에 붙는다** — `15.1km` 가 스크린리더에서도 단위와 함께 읽힌다.
         */}
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-fg-muted font-medium">
              {messages.walkCourse.distanceLabel}
            </dt>
            <dd className="text-title-2 text-fg font-semibold tabular-nums">
              {formatCourseDistance(course.distanceKm)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-fg-muted font-medium">
              {messages.walkCourse.durationLabel}
            </dt>
            {/* **원문 문자열이다** (`4~5시간`). 파싱하지 않는다 (공통명세 S3) */}
            <dd className="text-title-2 text-fg font-semibold">{course.durationText}</dd>
          </div>
        </dl>

        {/*
          **`startEndPoint` 를 갈라 쓰지 않는다** (D4-2). `제주민속촌주차장 입구-남원포구`
          처럼 공백과 하이픈이 섞여 있고 시설명 안에도 하이픈이 들어올 수 있어, 갈라
          재조립하면 잘못 갈리는 코스가 생긴다 — **원문 한 줄로 렌더한다.**
        */}
        <p className="flex flex-col gap-1">
          <span className="text-caption text-fg-muted font-medium">
            {messages.walkCourse.startEndLabel}
          </span>
          <span className="text-body-2 text-fg break-keep">{course.startEndPoint}</span>
        </p>
      </div>
    </header>
  )
}

/**
 * 출처 줄 — **`providerName` 과 `baseDate` 둘 다 서버 값이다.**
 *
 * **`baseDate` 를 `Date` 로 파싱하지 않는다** (D4-3). 계약이 문자열이고 `2025-04-28` 은
 * 자정 UTC 로 읽히면 KST 기준 하루 밀린다. 문자열 그대로 렌더하되 `<time>` 으로 시맨틱만 준다.
 */
export function WalkCourseSourceLine({ course }: { course: WalkCourseDetail }) {
  const [before = '', after = ''] = messages.walkCourse.source
    .replace('{provider}', course.providerName)
    .split('{date}')

  return (
    <p className={cn('text-caption text-fg-subtle break-keep', INSET_CLASS.card)}>
      {before}
      <time dateTime={course.baseDate}>{course.baseDate}</time>
      {after}
    </p>
  )
}
