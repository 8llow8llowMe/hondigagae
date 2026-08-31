import { Button } from '@/components/button'
import { Skeleton } from '@/components/skeleton'
import type { JobPollPhase } from '@/lib/ai-plan/job'
import { messages } from '@/lib/messages'
import type { CodeNameMetadata } from '@/types/api'

export type AiPlanProgressProps = {
  /** 서버 상태 metadata. 아직 첫 응답이 없으면 null */
  status: CodeNameMetadata | null
  phase: JobPollPhase
  onRecheck: () => void
  rechecking: boolean
}

/**
 * 생성 중 — 아트보드 02 ①.
 *
 * **진행 단계 목록을 만들지 않는다.** `AiPlanJobStatus` 는 넷뿐이고 세부 단계가 계약에
 * 없다 (명세 S2). 아트보드의 `3 / 5 단계` · `약 12초 남음` 은 지어내면 거짓 진행률이
 * 되므로 **서버 `status.description` 만** 쓴다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanProgress({ status, phase, onRecheck, rechecking }: AiPlanProgressProps) {
  const description = status?.description ?? messages.aiPlan.jobProgressFallback

  if (phase === 'exceeded') {
    /*
      **상한을 넘기면 폴링을 멈추고 수동 확인을 준다** (명세 S4 · S8 미결 3).
      `ErrorState` 를 쓰지 않는다 — 실패가 아니고 작업은 아직 살아 있을 수 있다.
    */
    return (
      <div className="flex flex-col items-start gap-2 px-4 py-12 md:px-10">
        <h2 className="text-body-1 text-fg font-semibold">{messages.aiPlan.jobExceededTitle}</h2>
        <p className="text-body-2 text-fg-muted">{messages.aiPlan.jobExceededDescription}</p>
        <Button variant="secondary" className="mt-1" onClick={onRecheck} loading={rechecking}>
          {messages.aiPlan.jobExceededAction}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-10 md:px-10">
      {/*
        `aria-live="polite"` — 진행 문구가 바뀌는 것을 스크린리더가 알아야 한다.
        `role="status"` 를 쓰면 대기 중 내용이 바뀔 때마다 읽히는 것이 자연스럽다.
      */}
      <div role="status" aria-live="polite" className="flex flex-col gap-1">
        <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.jobProgressTitle}</h2>
        {/* 서버 문구를 그대로 쓴다 — FE 가 다시 쓰지 않는다 (styling-guide.md §7) */}
        <p className="text-body-2 text-fg-muted">{description}</p>
        {phase === 'slow' && (
          <p className="text-body-2 text-fg mt-1 font-medium">{messages.aiPlan.jobSlowNotice}</p>
        )}
      </div>

      {/*
        진행 표시는 **초안이 들어설 자리의 스켈레톤**이다. 스피너를 쓰면 얼마나
        남았는지 말하지 않으면서 계속 돌아 불안만 키운다.
      */}
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>

      <p className="text-caption text-fg-muted">{messages.aiPlan.jobLeaveHint}</p>
    </div>
  )
}
