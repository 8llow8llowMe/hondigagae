import { Button, ButtonLink } from '@/components/button'
import { messages } from '@/lib/messages'

export type AiPlanFailedProps = {
  /** 서버 `errorMessage`. 없으면 대체 문구를 쓴다 */
  errorMessage: string | null
  /** 입력 조건 요약. 조건을 잃었으면 null */
  conditionSummary: string | null
  /** 같은 조건으로 다시 제출. 조건이 없으면 줄 수 없다 */
  onRetry: (() => void) | null
  retrying: boolean
  /** 조건을 되살려 폼으로 */
  changeHref: string
  /**
   * `직접 만들기` 가 가는 곳. **`null` 이면 그 갈래를 주지 않는다.**
   *
   * 기본값은 새 일정 만들기다 — 생성 실패의 대안이 "AI 없이 직접 만든다" 이기 때문이다.
   * 하루 재생성(#128)에서는 **일정이 이미 있고 하루만 실패했으므로** 새 일정으로 보내는
   * 것이 잘못된 목적지다. 그 화면은 `null` 을 넘기고 `조건 바꾸기` 하나로 되돌아간다.
   */
  manualHref?: string | null
}

/**
 * 작업 실패 — 아트보드 02 ② · 명세 S7.
 *
 * **`ErrorState` 를 쓰지 않는다.** HTTP 200 이고 5xx 가 아니다. 실패 이유가 조건 문제일
 * 수 있어(`AIPLAN_012` — 조건에 맞는 장소를 찾지 못했습니다) **"일시 장애" 문구를 쓰지
 * 않고**, 입력 조건을 그대로 남긴 채 재시도 · 조건 변경 · 직접 만들기 세 갈래를 준다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanFailed({
  errorMessage,
  conditionSummary,
  onRetry,
  retrying,
  changeHref,
  manualHref = '/plans/new',
}: AiPlanFailedProps) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-12 md:px-10">
      <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.failedTitle}</h2>

      {/* 서버 문구를 그대로 쓴다 — 실패 이유를 우리가 다시 쓰면 조건 문제가 장애로 읽힌다 */}
      <p className="text-body-2 text-fg-muted">{errorMessage ?? messages.aiPlan.failedFallback}</p>

      <div className="mt-1 flex flex-wrap gap-2">
        {/*
          **재시도는 조건이 남아 있을 때만 준다.** 조건 없이 같은 요청을 만들 수 없다 —
          누를 수 없는 버튼을 보여 주는 대신 갈래에서 뺀다.
        */}
        {onRetry !== null && (
          <Button onClick={onRetry} loading={retrying}>
            {messages.aiPlan.failedRetry}
          </Button>
        )}
        <ButtonLink href={changeHref} variant="secondary">
          {messages.aiPlan.failedChange}
        </ButtonLink>
        {/* **목적지가 없으면 갈래에서 뺀다** — 재시도와 같은 판단이다 */}
        {manualHref !== null && (
          <ButtonLink href={manualHref} variant="ghost">
            {messages.aiPlan.failedManual}
          </ButtonLink>
        )}
      </div>

      {conditionSummary !== null && (
        <p className="text-caption text-fg-muted mt-1">
          {messages.aiPlan.failedKeptCondition.replace('{summary}', conditionSummary)}
        </p>
      )}
    </div>
  )
}
