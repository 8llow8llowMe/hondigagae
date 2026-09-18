'use client'

import type { ReactNode } from 'react'

import { BackLink } from '@/components/back-link'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { SurfaceStack } from '@/components/surface'
import { WalkCourseGoldenSlot } from '@/features/walk-course/walk-course-golden-slot'
import {
  WalkCourseSourceLine,
  WalkCourseSummaryHeader,
} from '@/features/walk-course/walk-course-summary-header'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { WalkTimesResponse } from '@/types/insight'
import type { WalkCourseDetail } from '@/types/walk-course'

export type WalkCourseDetailSectionProps = {
  course: WalkCourseDetail | null
  loading: boolean
  /** 실패한 요청의 HTTP 상태. 성공이면 null */
  errorStatus: number | null
  /** 서버가 준 `resultMessage` (문자열이 아닐 수 있다) */
  errorMessage?: unknown
  onRetry: () => void
  walkTimes: WalkTimesResponse | null
  walkTimesLoading: boolean
  onWalkTimesRetry: () => void
}

/**
 * 코스 상세 본문 — **표시 전용이다.** 조회 상태는 `WalkCourseDetailView` 가 props 로
 * 변환해 넘긴다 (`docs/testing-guide.md` §1).
 *
 * **데스크톱에서도 1열이다** (D1). 우측에 둘 것이 없다 — 좌표가 25/29 null 이라 지도도
 * 골든타임도 못 세운다. 카드 폭만 `content-container` 로 제한한다.
 *
 * **머리는 카드가 아니다** (`DESIGN.md` §0 카드 판정 3문 — 페이지 머리(h1)는 카드가 아니다).
 * 카드가 되는 것은 골든타임 자리 하나뿐이다.
 */
export function WalkCourseDetailSection({
  course,
  loading,
  errorStatus,
  errorMessage,
  onRetry,
  walkTimes,
  walkTimesLoading,
  onWalkTimesRetry,
}: WalkCourseDetailSectionProps) {
  if (loading) {
    return (
      <DetailShell heading={messages.walkCourse.pageTitle}>
        <div className={INSET_CLASS.card}>
          <BackLink href="/walk-courses" label={messages.walkCourse.backToList} />
        </div>
        <DetailSkeleton />
      </DetailShell>
    )
  }

  if (errorStatus !== null) {
    const kind = classify(errorStatus)

    /*
      **404 에 재시도 버튼을 달지 않는다.** 근거가 세 겹이다 (공통명세 S5):
      규칙(`frontend/CLAUDE.md`) · 계약(`WalkCourseErrorCode.NOT_FOUND_WALK_COURSE` 가
      `HttpStatus.NOT_FOUND` 로 못박혀 있고 단건 조회에 부수 조건이 없다) · 실측(같은 id 로
      두 번 물어 같은 404 를 받았다). **재시도는 사용자의 시간을 쓰고 아무것도 바꾸지 못한다.**

      대신 서버 `resultMessage` 를 그대로 노출하고 **다음 행동**(코스 목록으로)을 준다.
      `EmptyState` 는 `onRetry` 를 받지 않아 재시도 경로가 타입에서 막힌다.
    */
    if (kind === 'not-found') {
      return (
        <DetailShell heading={messages.walkCourse.detailNotFoundTitle}>
          <EmptyState
            inset="card"
            title={toMessage(errorMessage, messages.walkCourse.detailNotFoundTitle)}
            description={messages.walkCourse.pageDescription}
            action={<BackToList />}
          />
        </DetailShell>
      )
    }

    /*
      **400 도 재시도가 아니다** (`WALKCOURSE_113` — 숫자가 아닌 id). 주소가 틀린 것이라
      같은 요청은 같은 400 이다. `PlaceDetailInvalidId`(#496)와 같은 처치를 한다 —
      `ErrorState` 가 아니라 `EmptyState` + 다음 행동이다. 명세 D5 는 `ErrorState`
      (재시도 없음)라고 적었지만, `ErrorState.onRetry` 는 필수 prop 이라 그 조합이
      타입으로 성립하지 않는다. 장소 상세가 같은 이유로 같은 자리를 이렇게 그린다.
    */
    if (kind === 'validation') {
      return <WalkCourseDetailInvalidId errorMessage={errorMessage} />
    }

    // 5xx · 무응답 — 재시도를 제공한다
    return (
      <DetailShell heading={messages.walkCourse.errorTitle}>
        <ErrorState
          inset="card"
          title={messages.walkCourse.errorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
        />
        <div className={INSET_CLASS.card}>
          <BackToList />
        </div>
      </DetailShell>
    )
  }

  if (course === null) return null

  return (
    <SurfaceStack className="content-container">
      <div className={INSET_CLASS.card}>
        <BackLink href="/walk-courses" label={messages.walkCourse.backToList} />
      </div>

      <WalkCourseSummaryHeader course={course} />

      <WalkCourseGoldenSlot
        course={course}
        walkTimes={walkTimes}
        loading={walkTimesLoading}
        onRetry={onWalkTimesRetry}
      />

      <WalkCourseSourceLine course={course} />
    </SurfaceStack>
  )
}

/**
 * 주소의 `walkCourseId` 형식이 틀린 경우 (D0-1).
 *
 * **서버 컴포넌트가 물어보기 전에 여기로 보낸다** — `@PathVariable long` 이라 답이 400 으로
 * 정해져 있다. 화면 안에서 같은 400 을 잡았을 때와 **같은 말을 해야** 하므로 경계 파일이
 * 아니라 같은 컴포넌트를 쓴다 (#480 · #496 의 축).
 */
export function WalkCourseDetailInvalidId({ errorMessage }: { errorMessage?: unknown }) {
  return (
    <DetailShell heading={messages.common.validationErrorTitle}>
      <EmptyState
        inset="card"
        title={messages.common.validationErrorTitle}
        description={toMessage(errorMessage, messages.walkCourse.pageDescription)}
        action={<BackToList />}
      />
    </DetailShell>
  )
}

function BackToList() {
  return <BackLink href="/walk-courses" label={messages.walkCourse.backToList} />
}

/**
 * 상태 화면의 껍데기. **`h1` 을 `sr-only` 로 남긴다** — 성공 화면의 `h1` 은 `courseLabel`
 * 인데 여기서는 그 값을 모른다. 제목이 아예 없으면 문서 개요가 비고, 보이는 제목을
 * 지어내면 없는 코스 이름을 말하게 된다.
 *
 * **돌아가기를 껍데기가 그리지 않는다.** 빈·오류 상태는 그것을 `action` 으로 이미 갖고
 * 있어, 여기서도 그리면 같은 이름의 링크가 한 화면에 둘이 된다 — 보조기기에서 목적지가
 * 둘로 들린다. 스켈레톤만 자기 것을 따로 세운다.
 */
function DetailShell({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <SurfaceStack className="content-container">
      <h1 className="sr-only">{heading}</h1>
      {children}
    </SurfaceStack>
  )
}

/** 머리 + 정보 스켈레톤 (D5). 실제 머리와 같은 골격이라 응답이 와도 줄이 튀지 않는다 */
function DetailSkeleton() {
  return (
    <div className={cn('flex flex-col gap-3', INSET_CLASS.card)} aria-busy>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-6 w-2/3" />
      <div className="mt-2 flex gap-8">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Skeleton className="h-5 w-1/2" />
    </div>
  )
}
