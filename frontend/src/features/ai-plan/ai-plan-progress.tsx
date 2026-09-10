import { Button } from '@/components/button'
import { Skeleton } from '@/components/skeleton'
import type { JobPollPhase, JobStepProgress } from '@/lib/ai-plan/job'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { CodeNameMetadata } from '@/types/api'

export type AiPlanProgressProps = {
  /** 서버 상태 metadata. 아직 첫 응답이 없으면 null */
  status: CodeNameMetadata | null
  /** 지금 밟고 있는 세부 단계 metadata (#250). `PENDING` 이면 null */
  step: CodeNameMetadata | null
  /** `n / m` — 그릴 수 없으면 null (`lib/ai-plan/job.ts` 의 `jobStepProgress`) */
  stepProgress: JobStepProgress | null
  phase: JobPollPhase
  onRecheck: () => void
  rechecking: boolean
  /** 그만두기 (#250). null 이면 버튼을 그리지 않는다 */
  onCancel: (() => void) | null
  canceling: boolean
  /** 취소 요청 자체가 실패했는가. 작업은 계속 돌고 있으므로 진행 표시는 남는다 */
  cancelFailed: boolean
  /**
   * 좌우 여백 축 (`EmptyState` · `ErrorState` 와 같은 계약). 기본은 페이지 위 `main`
   * (16/40)이고 `/ai-plans/jobs/[jobId]` 가 그것을 쓴다.
   *
   * 하루 재생성(#451)은 이 표시가 L1 카드 안에 들어가 `card`(16/20)를 넘긴다 — 카드가
   * 이미 한 번 들어와 있어 안쪽까지 40 을 주면 내용이 두 번 밀린다 (`DESIGN.md §0`).
   */
  inset?: Inset
}

/**
 * 생성 중 — 아트보드 02 ①.
 *
 * **단계를 화면이 지어내지 않는다는 규칙은 그대로다.** 다만 이제 서버가 세부 단계를 준다
 * (#250 · PR #246) — `n / m` 과 단계 이름·설명 모두 서버 값이고, 여기서 만드는 것은
 * 배치뿐이다. 아트보드의 `약 12초 남음` 은 **여전히 계약에 없어 그리지 않는다.**
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanProgress({
  status,
  step,
  stepProgress,
  phase,
  onRecheck,
  rechecking,
  onCancel,
  canceling,
  cancelFailed,
  inset = 'main',
}: AiPlanProgressProps) {
  /*
    **세부 단계 설명이 있으면 그것이 더 정확하다.** `status.description` 은 "생성 중" 전체를
    설명하고 `step.description` 은 지금 하는 일을 말한다. 둘 다 서버 문구라 화면은 고르기만
    한다 (styling-guide.md §7).
  */
  const description =
    step?.description ?? status?.description ?? messages.aiPlan.jobProgressFallback

  /**
   * `className` 은 **레이아웃 유틸리티만** 받는다 (component-guide.md §3).
   *
   * 진행 화면에서 `-ml-3` 을 주는 이유: `ghost` 는 배경이 없어 좌우 padding 이 여백으로만
   * 보이고, 그대로 두면 버튼 글자가 위아래 문단보다 12px 안으로 들어가 **문단 정렬이
   * 어긋난 것처럼 읽힌다.** 상한 초과 화면에서는 채운 버튼 옆에 서므로 그대로 둔다.
   */
  const cancelButton = (className = '') =>
    onCancel === null ? null : (
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        loading={canceling}
        className={className}
      >
        {messages.aiPlan.jobCancel}
      </Button>
    )

  if (phase === 'exceeded') {
    /*
      **상한을 넘기면 폴링을 멈추고 수동 확인을 준다** (명세 S4 · S8 미결 3).
      `ErrorState` 를 쓰지 않는다 — 실패가 아니고 작업은 아직 살아 있을 수 있다.

      **그만두기는 여기에도 둔다.** 오래 걸리는 작업이야말로 그만둘 이유가 크고, 이 화면을
      벗어나는 것으로는 작업이 멈추지 않는다.
    */
    return (
      <div className={cn('flex flex-col items-start gap-2 py-12', INSET_CLASS[inset])}>
        <h2 className="text-body-1 text-fg font-semibold">{messages.aiPlan.jobExceededTitle}</h2>
        <p className="text-body-2 text-fg-muted">{messages.aiPlan.jobExceededDescription}</p>
        {cancelFailed && (
          <p className="text-body-2 text-danger-900">{messages.aiPlan.jobCancelFailed}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <Button variant="secondary" onClick={onRecheck} loading={rechecking}>
            {messages.aiPlan.jobExceededAction}
          </Button>
          {cancelButton()}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4 py-10', INSET_CLASS[inset])}>
      {/*
        `aria-live="polite"` — 진행 문구가 바뀌는 것을 스크린리더가 알아야 한다.
        `role="status"` 를 쓰면 대기 중 내용이 바뀔 때마다 읽히는 것이 자연스럽다.

        **단계 표시도 이 안에 둔다.** 밖에 두면 `2 / 4단계` 로 바뀌는 것을 낭독하지 않아
        진행을 눈으로만 알 수 있는 정보가 된다.
      */}
      <div role="status" aria-live="polite" className="flex flex-col gap-1">
        <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.jobProgressTitle}</h2>

        {/*
          **`PENDING` 이면 이 줄 자체가 없다.** 서버가 `stepOrder` 를 null 로 주므로
          (아직 시작하지 않았다는 뜻) 0 이나 1 로 채우면 시작한 것으로 그리게 된다.
        */}
        {stepProgress !== null && (
          <p className="text-body-2 text-fg font-medium">
            <span className="tabular-nums">
              {messages.aiPlan.jobStepProgress
                .replace('{order}', String(stepProgress.order))
                .replace('{total}', String(stepProgress.total))}
            </span>
            {step !== null && ` · ${step.name}`}
          </p>
        )}

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

      {onCancel !== null && (
        <div className="flex flex-col items-start gap-1">
          {cancelFailed && (
            <p className="text-body-2 text-danger-900">{messages.aiPlan.jobCancelFailed}</p>
          )}
          {cancelButton('-ml-3')}
          {/* 못 하는 일을 버튼 옆에서 미리 말한다 — 협조적 취소의 성질이다 */}
          <p className="text-caption text-fg-muted">{messages.aiPlan.jobCancelHint}</p>
        </div>
      )}
    </div>
  )
}
