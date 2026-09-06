import { Button, ButtonLink } from '@/components/button'
import { messages } from '@/lib/messages'

export type AiPlanCanceledProps = {
  /** 입력 조건 요약. 조건을 잃었으면 null */
  conditionSummary: string | null
  /** 같은 조건으로 다시 제출. 조건이 없으면 줄 수 없다 */
  onRetry: (() => void) | null
  retrying: boolean
  /** 조건을 되살려 폼으로 */
  changeHref: string
}

/**
 * 작업 취소 — #250.
 *
 * **`AiPlanFailed` 를 재사용하지 않는다.** 실패 화면은 서버 `errorMessage` 를 그리는 것이
 * 골자인데 **취소는 `errorCode`·`errorMessage` 가 비어 온다**(백엔드가 일부러 비운다) —
 * 태우면 사유 없는 "일정을 만들지 못했어요" 가 뜨고, 사용자가 스스로 그만둔 일이 장애처럼
 * 읽힌다.
 *
 * **`직접 만들기` 갈래를 주지 않는다.** 실패는 "AI 로는 안 되니 직접" 이 대안이지만, 취소는
 * 만들기 자체를 그만둔 것이라 그 제안이 맥락에 없다. 되돌아갈 두 갈래만 준다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanCanceled({
  conditionSummary,
  onRetry,
  retrying,
  changeHref,
}: AiPlanCanceledProps) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-12 md:px-10">
      <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.canceledTitle}</h2>
      <p className="text-body-2 text-fg-muted">{messages.aiPlan.canceledDescription}</p>

      <div className="mt-1 flex flex-wrap gap-2">
        {/*
          **재제출은 조건이 남아 있을 때만 준다** (`AiPlanFailed` 와 같은 판단).

          취소는 **멱등 키를 함께 풀어 준다** — 같은 조건으로 다시 넣는 것이 취소의 주된
          쓰임인데 키가 남으면 취소된 잡을 그대로 돌려받는다. 그래서 이 버튼이 실제로
          **새 작업**을 만든다.
        */}
        {onRetry !== null && (
          <Button onClick={onRetry} loading={retrying}>
            {messages.aiPlan.canceledRetry}
          </Button>
        )}
        <ButtonLink href={changeHref} variant="secondary">
          {messages.aiPlan.canceledChange}
        </ButtonLink>
      </div>

      {conditionSummary !== null && (
        <p className="text-caption text-fg-muted mt-1">
          {messages.aiPlan.failedKeptCondition.replace('{summary}', conditionSummary)}
        </p>
      )}
    </div>
  )
}
