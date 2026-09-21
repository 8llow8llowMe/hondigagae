'use client'

import type { ReactNode } from 'react'

import { BackLink } from '@/components/back-link'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { SurfaceStack } from '@/components/surface'
import { WalkCourseAddAction } from '@/features/walk-course/walk-course-add-action'
import { WalkCourseGoldenSlot } from '@/features/walk-course/walk-course-golden-slot'
import {
  WalkCourseHero,
  WalkCourseSourceLine,
  WalkCourseSummaryHeader,
} from '@/features/walk-course/walk-course-summary-header'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { imageSrc } from '@/lib/image/remote-host'
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
  /** `일정에 담기` 진입이 미로그인이면 로그인으로 보낸다 (#620 · D4-1) */
  authed: boolean
  /**
   * `코스 목록으로` 가 돌아갈 주소 ([#783](https://github.com/8llow8llowMe/hondigagae/issues/783)).
   *
   * **상세 URL 에는 필터가 없다.** 목록 행이 조건을 쿼리로 실어 보내고 라우트가 그것을
   * 읽어 여기로 넘긴다 — 없으면 목록 첫 화면으로 간다.
   *
   * **성공 화면에서만 쓴다.** 오류·404 에서는 사용자가 어느 목록에서 왔는지 화면이
   * 주장할 근거가 없다 (`BackToList` 는 이 값을 받지 않는다).
   */
  backHref?: string | undefined
}

/**
 * 코스 상세 본문 — **표시 전용이다.** 조회 상태는 `WalkCourseDetailView` 가 props 로
 * 변환해 넘긴다 (`docs/testing-guide.md` §1).
 *
 * **1024 이상에서만, 그것도 히어로가 있을 때만 2열이다**
 * ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)). D1 은 *"우측에 둘 것이
 * 없다 — 좌표가 25/29 null 이라"* 며 데스크톱에서도 1열로 뒀는데, 그 판단은 **히어로가
 * 있는 4개**에서 틀렸다: 16:9 히어로가 본문 폭을 다 먹어 이 화면의 차별 정보(골든타임)가
 * 접힘선 아래로 밀렸다(1280 실측 1400px = 뷰포트의 155%). 히어로와 좌표는 **같은 4개**에만
 * 있으므로, 2열이 서는 날은 우측에 세울 것이 실제로 있는 날이다. 나머지 25개는 그대로 1열이다.
 *
 * **머리는 카드가 아니다** (`DESIGN.md` §0 카드 판정 3문 — 페이지 머리(h1)는 카드가 아니다).
 * 카드가 되는 것은 골든타임 자리 하나뿐이고, **좌표가 없어도 그 카드는 남는다** (#730).
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
  authed,
  backHref = '/walk-courses',
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

  const hero = imageSrc(course.firstImage)

  /*
    **캡을 갈래에 따라 고른다** ([#781](https://github.com/8llow8llowMe/hondigagae/issues/781)).

    히어로가 없는 25/29 는 1440 을 그대로 채워 `거리 15.1km` 와 `소요시간 4~5시간` 이
    689px 떨어져 있었다 — 한 묶음으로 읽혀야 하는 값 둘이 눈으로 이을 수 없는 거리였다.
    글이 주인공인 단일 열이라 읽는 폭(760)에서 멈춘다.

    **히어로가 있는 4개는 캡하지 않는다.** `lg:grid-cols-2` 로 이미 각 681px 이라 읽는 폭
    안이고, 760 을 걸면 2열이 무너진다.

    **두 클래스를 겹쳐 달지 않는다** — 같은 특정도라 순서로 이기는 모양이 되어 스타일시트
    순서가 바뀌면 조용히 뒤집힌다 (`globals.css` 의 `.reading-container` 주석).
  */
  return (
    <SurfaceStack className={hero === null ? 'reading-container' : 'content-container'}>
      <div className={INSET_CLASS.card}>
        <BackLink href={backHref} label={messages.walkCourse.backToList} />
      </div>

      {/*
        **1024 이상에서 히어로가 좌측 열로 간다** (#730). 그 아래에서는 예전처럼 한 줄로
        쌓인다 — `gap` 값이 `SurfaceStack` 의 것과 같아(모바일 8 · 데스크톱 24) 열이
        갈리든 말든 카드 사이 리듬이 바뀌지 않는다 (DESIGN.md §0).

        **히어로가 없으면 두 열로 가르지 않는다.** 그 갈래가 25/29 이고, 빈 좌측 열을
        만들면 이 이슈가 고치려는 바로 그 증상(절반이 빈 화면)을 데스크톱에서 다시 만든다.
        `firstImage` 와 좌표는 **같은 4개**에만 있어(`types/walk-course.ts`) 두 열이 서는
        날은 골든타임도 실제로 서는 날이다.
      */}
      <div
        className={cn(
          'flex flex-col gap-2 md:gap-6',
          hero !== null && 'lg:grid lg:grid-cols-2 lg:items-start',
        )}
      >
        {hero !== null && <WalkCourseHero image={hero} />}

        <div className="flex flex-col gap-2 md:gap-6">
          <WalkCourseSummaryHeader course={course} />

          <WalkCourseGoldenSlot
            course={course}
            walkTimes={walkTimes}
            loading={walkTimesLoading}
            onRetry={onWalkTimesRetry}
          />
        </div>
      </div>

      {/* 진입은 상세에만 둔다 — 목록 행은 이미 전체가 링크다 (`올레담기-세부명세.md` D8-1) */}
      <div className={INSET_CLASS.card}>
        <WalkCourseAddAction course={course} authed={authed} />
      </div>

      {/*
        **출처는 CTA 아래다** (#730). 바로 위에 있던 동안에는 버튼에 딸린 설명처럼 읽혔다 —
        `제주올레 · 2025-04-28 기준` 은 이 **페이지 데이터**의 출처이지 그 버튼이 무엇을
        하는지에 대한 말이 아니다. 각주는 문서 끝에 선다.
      */}
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
