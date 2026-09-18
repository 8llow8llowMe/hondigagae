import { Button } from '@/components/button'
import {
  AiPlanJobBlock,
  AiPlanJobCondition,
  AiPlanJobFrame,
} from '@/features/ai-plan/ai-plan-job-frame'
import { formatElapsed } from '@/lib/ai-plan/elapsed'
import type { JobPollPhase, JobStepProgress } from '@/lib/ai-plan/job'
import { messages } from '@/lib/messages'
import type { Inset } from '@/lib/ui/inset'
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
   * 구독을 시작한 뒤 지난 시간 (#710). 생략하면 그 줄을 그리지 않는다.
   *
   * **하루 재생성(#451)은 넘기지 않아도 된다** — 넘기면 같은 줄이 나온다. 선택으로 둔 것은
   * 호출부가 늘 때 값을 못 구하는 자리가 있을 수 있어서지, 안 넘기는 것이 기본이라는 뜻은
   * 아니다.
   */
  elapsedMs?: number
  /**
   * 무엇을 만들고 있는지 (#710). 조건을 잃었으면 null 이고 블록째 그리지 않는다.
   *
   * 하루 재생성(#451)은 `null` 이다 — 그 화면은 조건이 아니라 **일정과 일자**가 맥락이고
   * `RegenerateShell` 의 머리가 이미 그것을 말한다.
   */
  conditionSummary?: string | null
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
 * 생성 중 — 아트보드 02 ① · 명세 S7.
 *
 * **단계를 화면이 지어내지 않는다는 규칙은 그대로다.** 서버가 세부 단계를 주고(#250 ·
 * PR #246) `n / m` 과 단계 이름·설명 모두 서버 값이다. 여기서 만드는 것은 배치뿐이다.
 * 아트보드의 `약 12초 남음` 은 **여전히 계약에 없어 그리지 않는다.**
 *
 * **스켈레톤을 걷었다** (#710). 이것은 설계가 아니라 지층이었다 — `b34675ac` 가 화면을
 * 만들 때는 세부 단계가 없어 스켈레톤이 **유일한 진행 신호**였고, `121d19a3` 이
 * `n / m단계` 를 얹으면서 진짜 신호가 생겼는데 낡은 쪽을 걷지 않았다. 남겨 둘 수 없는
 * 이유가 셋이다:
 *
 *  - **거짓 약속이다.** 스켈레톤의 관습적 의미는 "이 모양이 곧 여기 온다"(보통 수백 ms)
 *    인데, 완료되면 `AiPlanJobShell` 이 `bare` 로 빠져 **전혀 다른 카드 여럿**이 뜬다.
 *    모양도 자리도 맞지 않았다
 *  - **정보 0 에 304px 이다** (`24+16+64+16+64+16+24+16+64`). 카드 본문의 절반을 먹고
 *    `그만두기` 를 접힘 아래로 밀었다
 *  - **`prefers-reduced-motion` 에서는 죽은 화면이다.** `app/globals.css` 가
 *    `animation-duration: 0.01ms` 로 덮으므로 그 사용자에게는 80초 동안 정지한 회색
 *    덩어리였다 — 유일한 생존 신호가 꺼져 있었다
 *
 * 그 자리를 **경과 시간**과 **조건 블록**이 가져간다. 둘 다 관측값이라 지어낸 진행률이
 * 아니고, 후자는 `AiPlanJobView` 가 이미 쥐고 있던 값이다(#488).
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
  elapsedMs,
  conditionSummary = null,
  inset = 'main',
}: AiPlanProgressProps) {
  /*
    **세부 단계 설명이 있으면 그것이 더 정확하다.** `status.description` 은 "생성 중" 전체를
    설명하고 `step.description` 은 지금 하는 일을 말한다. 둘 다 서버 문구라 화면은 고르기만
    한다 (styling-guide.md §7).
  */
  const description =
    step?.description ?? status?.description ?? messages.aiPlan.jobProgressFallback

  const elapsed = elapsedMs === undefined ? null : formatElapsed(elapsedMs)

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

      **여기도 같은 골격을 쓴다** (#710) — 상한 초과는 진행의 한 국면이지 다른 화면이
      아니다. 조건 블록이 그대로 서 있어야 "무엇이 계속되고 있는가" 가 읽힌다.
    */
    return (
      <AiPlanJobFrame>
        <AiPlanJobBlock inset={inset}>
          <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.jobExceededTitle}</h2>
          <p className="text-body-2 text-fg-muted">{messages.aiPlan.jobExceededDescription}</p>
          {elapsed !== null && (
            <p className="text-caption text-fg-muted tabular-nums">
              {messages.aiPlan.jobElapsed.replace('{elapsed}', elapsed)}
            </p>
          )}
        </AiPlanJobBlock>

        <AiPlanJobCondition
          inset={inset}
          label={messages.aiPlan.jobConditionLabel}
          summary={conditionSummary}
        />

        <AiPlanJobBlock inset={inset}>
          {cancelFailed && (
            <p className="text-body-2 text-danger-900">{messages.aiPlan.jobCancelFailed}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={onRecheck} loading={rechecking}>
              {messages.aiPlan.jobExceededAction}
            </Button>
            {cancelButton()}
          </div>
        </AiPlanJobBlock>
      </AiPlanJobFrame>
    )
  }

  return (
    <AiPlanJobFrame>
      <AiPlanJobBlock inset={inset}>
        {/*
          `aria-live="polite"` — 진행 문구가 바뀌는 것을 스크린리더가 알아야 한다.
          `role="status"` 를 쓰면 대기 중 내용이 바뀔 때마다 읽히는 것이 자연스럽다.

          **단계 표시도 이 안에 둔다.** 밖에 두면 `2 / 4단계` 로 바뀌는 것을 낭독하지 않아
          진행을 눈으로만 알 수 있는 정보가 된다.

          **경과 시간은 반드시 이 밖이다** (#710). 1초마다 바뀌는 값이라 안에 넣으면
          스크린리더가 **매 초 낭독한다** — 화면을 못 보는 사용자에게는 진행 안내가 아니라
          소음이 되고, 그 사이 진짜로 바뀐 단계 이름이 묻힌다.
        */}
        <div role="status" aria-live="polite" className="flex flex-col items-start gap-1">
          <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.jobProgressTitle}</h2>

          {/*
            **`PENDING` 이면 이 줄 자체가 없다.** 서버가 `stepOrder` 를 null 로 주므로
            (아직 시작하지 않았다는 뜻) 0 이나 1 로 채우면 시작한 것으로 그리게 된다.
          */}
          {stepProgress !== null && (
            <p className="text-body-2 text-fg flex items-center gap-2 font-medium">
              <StepTicks progress={stepProgress} />
              {/*
                **숫자와 단계 이름을 한 요소에 담는다.** 둘로 나누면 flex 의 `gap-2` 가
                가운뎃점 앞에도 붙어 `4 / 4단계  · 일정 구성` 처럼 한 칸이 더 벌어진다 —
                `gap` 은 눈금과 글줄 사이에만 있어야 한다.
              */}
              <span className="tabular-nums">
                {messages.aiPlan.jobStepProgress
                  .replace('{order}', String(stepProgress.order))
                  .replace('{total}', String(stepProgress.total))}
                {step !== null && ` · ${step.name}`}
              </span>
            </p>
          )}

          {/* 서버 문구를 그대로 쓴다 — FE 가 다시 쓰지 않는다 (styling-guide.md §7) */}
          <p className="text-body-2 text-fg-muted">{description}</p>
          {phase === 'slow' && (
            <p className="text-body-2 text-fg font-medium">{messages.aiPlan.jobSlowNotice}</p>
          )}
        </div>

        {/*
          **낭독 영역 밖이다.** 위 주석 참고 — 1초마다 바뀌는 값이고, 눈으로 보는 사람에게만
          쓸모가 있다.
        */}
        {elapsed !== null && (
          <p aria-hidden className="text-caption text-fg-muted tabular-nums">
            {messages.aiPlan.jobElapsed.replace('{elapsed}', elapsed)}
          </p>
        )}
      </AiPlanJobBlock>

      <AiPlanJobCondition
        inset={inset}
        label={messages.aiPlan.jobConditionLabel}
        summary={conditionSummary}
      />

      <AiPlanJobBlock inset={inset}>
        {cancelFailed && (
          <p className="text-body-2 text-danger-900">{messages.aiPlan.jobCancelFailed}</p>
        )}
        {cancelButton('-ml-3')}
        {/*
          **버튼의 한계를 먼저, 화면을 떠나도 된다는 말을 나중에.** 둘 다 이 자리에서
          필요하지만 순서가 뒤집히면 `그만두기` 바로 아래 문장이 그 버튼과 무관한 말이 되고,
          정작 "즉시 멈추지 않는다" 는 세 번째 문장으로 밀려 버튼과 멀어진다.

          예전에는 두 문구가 스켈레톤을 사이에 두고 갈라져 있었다 — `그만두기` 가 두 caption
          사이에 끼여 어느 쪽이 버튼 설명인지 읽히지 않았다.
        */}
        <p className="text-caption text-fg-muted">
          {onCancel !== null && `${messages.aiPlan.jobCancelHint} `}
          {messages.aiPlan.jobLeaveHint}
        </p>
      </AiPlanJobBlock>
    </AiPlanJobFrame>
  )
}

/**
 * 단계 눈금 (#710) — `4 / 4단계` 가 주는 **"다 됐는데 왜 멈춰 있나"** 를 구조가 해소한다.
 *
 * **서버가 준 `order` · `total` 로만 그린다.** 칸 수는 `total` 이고 채운 칸은 `order` 다 —
 * 단계 이름을 화면이 상수로 적지 않는다는 규칙(명세 S2 · #250)을 그대로 지킨다. 백엔드가
 * 단계를 늘리면 칸도 는다.
 *
 * **지나간 칸과 지금 칸을 가른다.** 앞의 셋이 끝났고 **긴 것 하나가 남았다**가 보이면,
 * 같은 숫자가 "끝났는데 멈췄다" 가 아니라 "마지막 하나를 하고 있다" 로 읽힌다. 실제로
 * `DRAFTING`(LLM 호출)이 전체의 90% 이상이라 사람이 보는 거의 모든 시간이 이 상태다.
 *
 * **길이로 소요 시간을 말하지 않는다.** 칸 폭을 실제 비중대로 4:1:1:94 로 그리는 안은
 * 접었다 — 그 비율은 실행마다 다르고, 고정 비율로 그리면 그 순간부터 거짓이 된다
 * (`AiPlanJobStep` 머리주석: "화면이 단계를 지어내면 거짓 진행률이 된다").
 *
 * `aria-hidden` 이다 — 옆의 `n / m단계` 가 같은 것을 말하고 그쪽이 낭독된다.
 */
function StepTicks({ progress }: { progress: JobStepProgress }) {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {Array.from({ length: progress.total }, (_, index) => {
        const done = index < progress.order - 1
        const current = index === progress.order - 1

        return (
          <span
            key={index}
            className={cn(
              'h-1 w-5 rounded-full',
              done && 'bg-fg',
              /*
                지금 칸만 맥동한다. 예전에는 스켈레톤 다섯이 **같은 위상으로** 2초 주기로
                깜빡여, 호흡이 아니라 점멸로 읽혔다 (#710).
              */
              current && 'bg-fg-muted animate-pulse',
              !done && !current && 'bg-band',
            )}
          />
        )
      })}
    </span>
  )
}
