'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceList } from '@/components/surface'
import { WalkCourseColumnHead, WalkCourseRow } from '@/features/walk-course/walk-course-row'
import {
  WALK_COURSE_SKELETON_COUNT,
  WalkCourseRowSkeleton,
} from '@/features/walk-course/walk-course-row-skeleton'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { formatDuration } from '@/lib/format/duration'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import { hasCoordinates } from '@/lib/walk-course/coordinates'
import type { WalkCourseFilters, WalkCourseSummary } from '@/types/walk-course'

/**
 * 기준 줄에 들어갈 값. **응답의 `appliedPetActivityLevel` 이 있을 때만 만든다** — 로컬
 * 상태가 아니라 **응답**을 믿는다 (공통명세 S4-1 규칙 5).
 *
 * **셋 다 서버 값이다** (#735). `levelName` 은 `appliedPetActivityLevel.level.name`,
 * `maxDurationMinutes` 는 같은 객체의 상한이다 — 전에는 이름을 반려견 프로필에서 가져오고
 * 상한은 FE 상수(4·6시간)로 적었다.
 *
 * `petName` 만 반려견 프로필에서 온다. **URL 이 비어 대표견으로 채운 경우에만** 채워지므로
 * `null` 일 수 있다 (`walk-course-list-view.tsx`).
 */
export type WalkCourseBasis = {
  petName: string | null
  levelName: string
  /** 서버가 적용한 상한(분). **`HIGH`(상한 없음)는 기준 줄 자체를 만들지 않는다** */
  maxDurationMinutes: number
}

export type WalkCourseListSectionProps = {
  courses: readonly WalkCourseSummary[]
  totalCount: number
  /** 서버가 활동량을 실제로 적용했을 때만 준다. `null` 이면 **기준 줄을 만들지 않는다** */
  basis: WalkCourseBasis | null
  /** 출처. **서버 `providerName` 을 그대로 쓴다** — FE 가 출처 문자열을 만들지 않는다 */
  providerName: string | null
  loading: boolean
  /** 실패한 요청의 HTTP 상태. 성공이면 null */
  errorStatus: number | null
  /** 서버가 준 `resultMessage` (문자열이 아닐 수 있다) */
  errorMessage?: unknown
  onRetry: () => void
  /** `?activity=ALL` 로 보낸다 — 0건·400 에서 주는 **다음 행동**이다 */
  onShowAll: () => void
  /** 조건 컨트롤. **라우터를 아는 쪽이 만들어 넘긴다** — 이 컴포넌트는 순수하게 남는다 */
  tools?: ReactNode
  /**
   * 지금 보고 있는 조건 ([#783](https://github.com/8llow8llowMe/hondigagae/issues/783)).
   * 행이 상세 링크에 실어 보내면 상세의 `코스 목록으로` 가 같은 목록으로 돌아온다.
   */
  filters?: WalkCourseFilters | undefined
}

/**
 * 코스 목록 카드 — **이 화면의 L1 카드다** (`DESIGN.md §0`).
 *
 * **좌측 필터 레일을 두지 않는다** (D1). 축이 둘(걷는 시간·정렬)뿐이라 280 레일을 세우면
 * 빈 열이 된다. 도구는 카드 **머리**, 결과는 **본문** 이다 (`Surface` 의 `fill` 절).
 *
 * 표시 전용이다 — 조회 상태는 `WalkCourseListView` 가 props 로 변환해 넘긴다
 * (`docs/testing-guide.md` §1: 훅을 쓰는 컴포넌트는 node 환경에서 렌더되지 않는다).
 */
export function WalkCourseListSection({
  courses,
  totalCount,
  basis,
  providerName,
  loading,
  errorStatus,
  errorMessage,
  onRetry,
  onShowAll,
  tools,
  filters,
}: WalkCourseListSectionProps) {
  // 개수는 목록이 실제로 있을 때만 말한다 — 로딩 중에는 아직 모르고 오류에는 셀 수 없다
  const countable = !loading && errorStatus === null

  return (
    <Surface
      lead
      titleId="walk-course-list-heading"
      title={messages.walkCourse.pageTitle}
      description={
        countable ? (
          <div className="flex flex-col gap-1">
            {/*
              **조건을 바꾸면 결과 수를 알린다** (D6). 세그먼트는 URL 을 바꾸고 목록이
              통째로 갈리는데, 보조기기에는 그 변화를 말해 주는 것이 이 줄뿐이다.
            */}
            <p aria-live="polite" className="text-body-2 text-fg-muted tabular-nums">
              {messages.walkCourse.listCount.replace('{count}', String(totalCount))}
            </p>
            {basis !== null && <p className="text-caption text-fg-muted">{basisLine(basis)}</p>}
          </div>
        ) : undefined
      }
      tools={tools}
    >
      <WalkCourseListBody
        courses={courses}
        loading={loading}
        errorStatus={errorStatus}
        errorMessage={errorMessage}
        basisApplied={basis !== null}
        filters={filters}
        onRetry={onRetry}
        onShowAll={onShowAll}
      />

      {/*
        **출처는 서버 문자열이다.** 목록이 비었거나 실패했을 때는 세울 근거가 없다.
        카드 안 마지막 블록이라 위에 1px 선을 둔다 — 목록의 끝이 어디인지 카드 테두리만으로는
        말할 수 없다 (`/favorites` 의 AI 안내 줄과 같은 자리).
      */}
      {countable && providerName !== null && courses.length > 0 && (
        <p
          className={cn(
            'border-border text-caption text-fg-subtle border-t py-4 break-keep',
            INSET_CLASS.card,
          )}
        >
          {providerName}
        </p>
      )}
    </Surface>
  )
}

/**
 * 기준 줄. 반려견 이름을 모르면 이름 없는 문장으로 떨어진다 — 사용자가 세그먼트로 직접
 * 골랐거나, 대표견 조회가 실패했는데 `?activity=LOW` 를 손으로 들고 들어온 경우다.
 * **없는 이름을 지어내지 않는다.**
 *
 * **상한은 서버 분(minute)을 `formatDuration` 으로 옮겨 적는다** — `240` → `4시간`.
 * 단위 변환일 뿐이라 서버가 상한을 `270` 으로 바꾸면 화면도 `4시간 30분` 으로 따라간다.
 */
function basisLine({ petName, levelName, maxDurationMinutes }: WalkCourseBasis): string {
  const filled = (template: string) =>
    template.replace('{limit}', formatDuration(maxDurationMinutes)).replace('{level}', levelName)

  if (petName === null) {
    return filled(messages.walkCourse.activityBasisWithoutPet)
  }

  return filled(messages.walkCourse.activityBasis).replace('{pet}', petName)
}

/**
 * 카드 안 네 상태. **배타적으로** 렌더한다 (D5).
 *
 * **0건과 404 를 한 컴포넌트로 합치지 않는다** (공통명세 S5). 목록의 "0개" 는 200 + 빈
 * 배열이라 `resultMessage` 자체가 없다 — 404 문구를 재활용하면 **빈 문구가 나간다.**
 */
function WalkCourseListBody({
  courses,
  loading,
  errorStatus,
  errorMessage,
  basisApplied,
  filters,
  onRetry,
  onShowAll,
}: Pick<
  WalkCourseListSectionProps,
  'courses' | 'loading' | 'errorStatus' | 'errorMessage' | 'onRetry' | 'onShowAll' | 'filters'
> & {
  basisApplied: boolean
}) {
  const inset = 'card'

  if (loading) {
    return (
      <SurfaceList aria-busy>
        {Array.from({ length: WALK_COURSE_SKELETON_COUNT }, (_, index) => (
          <WalkCourseRowSkeleton key={index} inset={inset} />
        ))}
      </SurfaceList>
    )
  }

  if (errorStatus !== null) {
    /*
      **400 에 재시도를 주지 않는다** — 손으로 고친 URL 이라 같은 요청은 같은 400 이다.
      대신 서버 `resultMessage` 를 그대로 노출하고 **다음 행동**(전체 코스 보기)을 준다.
      `WALKCOURSE_101`(maxDistanceKm 범위) · `WALKCOURSE_113`(enum 형식)이 여기로 온다.
    */
    if (classify(errorStatus) === 'validation') {
      return (
        <ErrorState
          inset={inset}
          headingLevel={3}
          title={messages.common.validationErrorTitle}
          description={toMessage(errorMessage, messages.walkCourse.emptyDescription)}
          retryLabel={messages.walkCourse.emptyAction}
          onRetry={onShowAll}
        />
      )
    }

    // 5xx · 무응답 — 재시도를 제공한다
    return (
      <ErrorState
        inset={inset}
        headingLevel={3}
        title={messages.walkCourse.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  if (courses.length === 0) {
    return (
      <EmptyState
        inset={inset}
        headingLevel={3}
        title={messages.walkCourse.emptyTitle}
        description={messages.walkCourse.emptyDescription}
        action={
          <Button variant="secondary" size="md" onClick={onShowAll}>
            {messages.walkCourse.emptyAction}
          </Button>
        }
      />
    )
  }

  /*
    **좁힌 결과에 좌표 있는 코스가 하나도 없으면 그 사실을 말한다** (D8-2 ②).

    실측에서 `LOW`(4시간 이내)가 정확히 그 경우다 — 좌표가 있는 넷이 모두 `4~5시간`·
    `5~6시간` 이라 전부 걸러진다. 활동량 낮은 아이의 보호자는 골든타임을 한 번도 못 본다.

    **`activity === 'LOW'` 로 판정하지 않는다.** 데이터에서 읽으면 적재(#383)가 좌표를
    채우는 순간 이 줄이 저절로 사라진다 — 상수로 박으면 그때 거짓말이 된다.
    좁히지 않은 목록(29개)에는 좌표 있는 코스가 있으므로 이 줄이 서지 않는다.
  */
  const noGoldenInScope = basisApplied && courses.every((course) => !hasCoordinates(course))

  return (
    <>
      {noGoldenInScope && (
        <p className={cn('text-caption text-fg-muted pb-3 break-keep', INSET_CLASS[inset])}>
          {messages.walkCourse.noGoldenInScope}
        </p>
      )}

      {/* 1280 이상 전용 열 머리 — 행과 같은 그리드를 공유한다 (#734) */}
      <WalkCourseColumnHead inset={inset} />

      {/*
        **`InfiniteScrollSentinel` 이 없다.** 커서가 없고 29개 전량이 한 번에 온다
        (공통명세 S3) — 목록 끝의 `마지막 장소예요` 줄도 이 화면의 말이 아니다.
      */}
      <SurfaceList>
        {courses.map((course) => (
          <WalkCourseRow
            key={course.walkCourseId}
            course={course}
            inset={inset}
            filters={filters}
          />
        ))}
      </SurfaceList>
    </>
  )
}
