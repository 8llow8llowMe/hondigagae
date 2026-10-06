'use client'

import { useEffect, useId, useRef } from 'react'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { FormNotice } from '@/components/form-notice'
import { messages } from '@/lib/messages'
import {
  type PlanStatusActionKind,
  type PlanStatusActionSpec,
  type PlanStatusResult,
  statusResultOpensShare,
} from '@/lib/plan/status-action'

export type PlanStatusActionPanelProps = {
  /**
   * 개요 아래에 설 **정방향 액션 하나**. 없으면(완료 일정) 버튼을 그리지 않는다 (#653).
   *
   * 역방향은 이 패널이 아니라 `⋯` 메뉴가 갖는다 — 명세 D11-2.
   */
  action: PlanStatusActionSpec | undefined
  labels: Record<PlanStatusActionKind, string>
  /** 버튼 아래 한 줄 — 그 액션이 무엇을 여는지 (#1154). 없는 액션은 줄이 없다 */
  notes?: Partial<Record<PlanStatusActionKind, string>>
  errorMessage: string | null
  /**
   * 마지막으로 성공한 전이 (#1174). **`usePlanStatus` 가 든 값을 그대로 받는다** — 포커스
   * effect 가 이 값의 동일성에 걸려 있어, 호출부가 렌더마다 새 객체를 만들면 렌더마다
   * 포커스를 빼앗는다.
   */
  result: PlanStatusResult | null
  resultMessages: Record<PlanStatusActionKind, string>
  /** 확정 결과 아래 `공유 링크` 가 여는 것. 없으면 버튼을 그리지 않는다 */
  onShare?: (() => void) | undefined
  saving: boolean
  onAction: (action: PlanStatusActionSpec) => void
}

/**
 * 일정 상태 버튼 줄. 조회·mutation 은 바깥(`usePlanStatus`)이 갖는다 —
 * React Query 컴포넌트는 renderToStaticMarkup 으로 못 본다.
 *
 * **버튼이 없어도 사라지지 않는다.** 역방향 액션은 메뉴 안에 있고 그 실패를 말할 자리가
 * 여기뿐이라(메뉴는 선택과 동시에 닫힌다), `action` 이 없어도 `errorMessage` 가 있으면
 * 이 자리가 남아야 한다.
 *
 * ## `INSET_CLASS.card` 를 쓰지 않는다 (#845)
 *
 * 그 인셋은 **글자의 세로선**을 카드 안 글자와 맞추려는 규칙이다 (`lib/ui/inset.ts` 의
 * `card` 문단: "아래 카드의 첫 글자와 세로선이 갈린다"). 그런데 이 자리에 서는 것은 글자가
 * 아니라 **면을 가진 전폭 버튼**이고, 면의 경계는 글자가 아니라 위아래 `Surface` 의 테두리와
 * 비교된다. 인셋을 주면 버튼이 카드보다 좌우 16(모바일) · 20(데스크톱) 씩 좁아져 **레일의
 * 세로 경계가 버튼 한 줄에서만 안으로 꺾인다** — 768 이상에서 눈에 그대로 걸렸다.
 *
 * 그래서 이 래퍼는 평평하다. `Surface` 가 `border-y md:rounded-lg md:border` 라 카드의
 * 바깥 경계가 곧 이 자리의 폭이고, 버튼과 카드가 같은 세로선에 선다. `FormAlert` 도 같은
 * 폭을 받는다 — 그쪽은 글자지만 **버튼 바로 아래 붙는 부속**이라 버튼의 경계를 따른다.
 *
 * ## 성공도 여기서 말한다 (#1174)
 *
 * 전이가 끝나면 **결과 한 줄이 맨 위에 선다** — 확정이면 그 아래 `공유 링크` 까지. 출발 전
 * 확정 일정과 완료 일정은 버튼 자리가 통째로 비므로, 예전에는 누른 버튼이 사라지기만 하고
 * 포커스가 `BODY` 로 떨어졌다. 결과가 맨 위인 것은 포커스가 거기 내려앉아 **읽는 순서가
 * 결과 → 다음 행동**이 되게 하려는 것이다.
 *
 * 읽히는 길은 `result.announce` 하나가 정한다 — `focus` 면 안내로 포커스를 옮기고 역할을 뗀다,
 * `live` 면 포커스는 그대로(`⋯` 트리거) 두고 `role="status"` 로 읽힌다 (form-guide.md §8).
 */
export function PlanStatusActionPanel({
  action,
  labels,
  notes = {},
  errorMessage,
  result,
  resultMessages,
  onShare,
  saving,
  onAction,
}: PlanStatusActionPanelProps) {
  const noteId = useId()
  const resultRef = useRef<HTMLParagraphElement>(null)

  // 같은 판정(`announce`)이 역할과 포커스를 함께 정한다 — 하나만 따로 놀면 무음이거나 두 번 읽힌다
  useEffect(() => {
    if (result?.announce === 'focus') resultRef.current?.focus()
  }, [result])

  if (action === undefined && errorMessage === null && result === null) return null

  const note = action === undefined ? undefined : notes[action.kind]
  const share = result !== null && statusResultOpensShare(result.kind) ? onShare : undefined

  return (
    <div className="flex flex-col gap-2">
      {result !== null && (
        <FormNotice
          ref={resultRef}
          message={resultMessages[result.kind]}
          announce={result.announce}
        />
      )}
      {share !== undefined && (
        <Button variant="secondary" onClick={share} className="w-full">
          {messages.plan.shareAction}
        </Button>
      )}
      {action !== undefined && (
        <Button
          variant={action.variant}
          onClick={() => onAction(action)}
          loading={saving}
          className="w-full"
          // 안내를 버튼의 설명으로 잇는다 — 스크린 리더가 버튼 이름과 함께 읽는다
          aria-describedby={note === undefined ? undefined : noteId}
        >
          {labels[action.kind]}
        </Button>
      )}
      {note !== undefined && (
        <p id={noteId} className="text-caption text-fg-muted text-center">
          {note}
        </p>
      )}
      <FormAlert message={errorMessage} />
    </div>
  )
}
