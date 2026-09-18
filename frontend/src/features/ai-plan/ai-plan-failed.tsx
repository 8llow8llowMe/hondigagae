import Link from 'next/link'

import { Button, ButtonLink } from '@/components/button'
import {
  AiPlanJobBlock,
  AiPlanJobCondition,
  AiPlanJobFrame,
} from '@/features/ai-plan/ai-plan-job-frame'
import { ServerReason } from '@/features/ai-plan/server-reason'
import { messages } from '@/lib/messages'
import type { Inset } from '@/lib/ui/inset'

export type AiPlanFailedProps = {
  /**
   * 화면 제목. **기본값은 생성 실패다** (`일정을 만들지 못했어요`).
   *
   * 하루 재생성(#128)은 다른 말을 한다 — **하루가 실패했을 뿐 일정은 그대로 있다.**
   * 기본값을 그대로 쓰면 없어지지 않은 것을 없어졌다고 말한다.
   */
  title?: string
  /** 서버 `errorMessage`. 없으면 대체 문구를 쓴다 */
  errorMessage: string | null
  /**
   * 서버 문구 **아래에 덧붙이는** 한 줄 (#251). 없으면 렌더하지 않는다.
   *
   * **서버 문구를 대신하지 않는다.** 서버가 아는 것("장소를 찾지 못했다")과 화면만 아는
   * 것(좁힌 지역이 원인일 수 있다 · 기간을 줄이면 빨라진다)이 다르고, 둘 다 필요하다.
   */
  hint?: string | null
  /** 입력 조건 요약. 조건을 잃었으면 null */
  conditionSummary: string | null
  /** 같은 조건으로 다시 제출. 조건이 없으면 줄 수 없다 */
  onRetry: (() => void) | null
  retrying: boolean
  /** 조건을 되살려 폼으로 */
  changeHref: string
  /**
   * `AI 없이 직접 만들기` 가 가는 곳. **`null` 이면 그 갈래를 주지 않는다.**
   *
   * 기본값은 새 일정 만들기다 — 생성 실패의 대안이 "AI 없이 직접 만든다" 이기 때문이다.
   * 하루 재생성(#128)에서는 **일정이 이미 있고 하루만 실패했으므로** 새 일정으로 보내는
   * 것이 잘못된 목적지다. 그 화면은 `null` 을 넘기고 `조건 바꾸기` 하나로 되돌아간다.
   */
  manualHref?: string | null
  /**
   * 좌우 여백 축 (`EmptyState` · `ErrorState` 와 같은 계약). 기본은 페이지 위 `main`
   * (16/40)이고 `/ai-plans/jobs/[jobId]` 가 그것을 쓴다.
   *
   * 하루 재생성(#451)은 이 화면이 L1 카드 안에 들어가 `card`(16/20)를 넘긴다 — 카드가
   * 이미 한 번 들어와 있어 안쪽까지 40 을 주면 내용이 두 번 밀린다 (`DESIGN.md §0`).
   */
  inset?: Inset
}

/**
 * 작업 실패 — 아트보드 02 ② · 명세 S7.
 *
 * **`ErrorState` 를 쓰지 않는다.** HTTP 200 이고 5xx 가 아니다. 실패 이유가 조건 문제일
 * 수 있어(`AIPLAN_012` — 조건에 맞는 장소를 찾지 못했습니다) **"일시 장애" 문구를 쓰지
 * 않고**, 입력 조건을 그대로 남긴 채 재시도 · 조건 변경 · 직접 만들기 세 갈래를 준다.
 *
 * **진행 · 취소와 같은 골격을 쓴다** (#710, `AiPlanJobFrame`). 셋은 한 이야기의 세
 * 순간이라 조건과 액션이 상태가 바뀌어도 제자리에 있어야 한다.
 *
 * **버튼 위계를 2단으로 줄였다** (#710). 예전에는 채움 / 테두리 / **무테** 셋이 한 행에
 * 섰는데, `ghost` 는 배경도 테두리도 없어 그 행에서 혼자 버튼으로 읽히지 않았다. 세 갈래의
 * 무게가 실제로 같지도 않다 — 앞의 둘은 이 작업을 이어가는 길이고 `AI 없이 직접 만들기` 는
 * **AI 를 포기하는 길**이라, 행에서 내려 링크로 두는 것이 무게와도 맞는다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanFailed({
  title = messages.aiPlan.failedTitle,
  errorMessage,
  conditionSummary,
  onRetry,
  retrying,
  changeHref,
  manualHref = '/plans/new',
  hint = null,
  inset = 'main',
}: AiPlanFailedProps) {
  return (
    <AiPlanJobFrame>
      <AiPlanJobBlock inset={inset}>
        <h2 className="text-title-2 text-fg font-semibold">{title}</h2>

        {/* 서버 문구를 그대로 쓴다 — 실패 이유를 우리가 다시 쓰면 조건 문제가 장애로 읽힌다 */}
        <ServerReason>{errorMessage ?? messages.aiPlan.failedFallback}</ServerReason>

        {/* 화면만 아는 단서를 아래에 덧붙인다 (#251) — 서버 문구를 덮지 않는다 */}
        {hint !== null && <p className="text-body-2 text-fg font-medium">{hint}</p>}
      </AiPlanJobBlock>

      <AiPlanJobCondition
        inset={inset}
        label={messages.aiPlan.jobConditionKeptLabel}
        summary={conditionSummary}
      />

      <AiPlanJobBlock inset={inset}>
        <div className="flex flex-wrap gap-2">
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
        </div>

        {/*
          **목적지가 없으면 갈래에서 뺀다** — 재시도와 같은 판단이다.

          `h-11` 은 모바일 최소 터치 영역이다 (DESIGN.md §7) — 버튼 행에서 내려온 갈래라
          누를 수 있는 크기는 그대로여야 한다. 반려견 삭제 링크(`pet-edit-view.tsx`)와 같은
          모양이다: 되돌아가는 성격의 텍스트 링크.
        */}
        {manualHref !== null && (
          <Link
            href={manualHref}
            className="text-body-2 text-fg-muted focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {messages.aiPlan.failedManual}
          </Link>
        )}
      </AiPlanJobBlock>
    </AiPlanJobFrame>
  )
}
