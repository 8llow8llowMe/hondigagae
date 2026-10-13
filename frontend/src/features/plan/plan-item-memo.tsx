'use client'

import { useId, useState } from 'react'

import { Button } from '@/components/button'
import { messages } from '@/lib/messages'
import type { PlanItemMemoView } from '@/lib/plan/item-memo'
import { fillTemplate } from '@/lib/text/template'
import { cn } from '@/lib/utils/cn'

type PlanItemMemoProps = {
  /** `planItemMemoView(item.memo)` 의 결과. `null` 이면 호출부가 이 컴포넌트를 세우지 않는다 */
  memo: PlanItemMemoView
  /** 접근 이름에 넣을 항목 이름 */
  title: string
  /**
   * `메모 수정` 진입점 (#1460 · D30). **optional 이다** — 넘기지 않으면 버튼이 없다. 기간 밖
   * 항목 섹션처럼 저장할 일자가 없는 사용처가 그 경로다.
   */
  edit?: PlanItemMemoEdit | undefined
}

/** 메모 고치기 진입점 — 모달을 연다. 저장 · 잠금은 호출부가 소유한다 */
export type PlanItemMemoEdit = {
  onOpen: () => void
  /** 저장 뒤 초점을 돌려받을 표식 — 일괄 교체가 `planItemId` 를 새로 발급해 버튼이 다시 마운트된다 */
  focusKey: string
}

/**
 * 일정 상세 항목 메모 — 이슈 #1448 · `일정상세-세부명세.md` D29.
 *
 * **위계: 제목 > 메모 > 캡션.** 제목(`text-title-2` 600) 아래 보조 설명이라 `text-body-2`
 * 보조색이다 — AI 초안 미리보기의 항목 설명(#1432, `ai-plan-draft-item-row.tsx`)과 같은
 * 글자 등급이라 담기 전후에 같은 무게로 읽힌다. 메타 · 거리 캡션(`text-caption`)보다는 크다.
 *
 * 두 줄에서 접고 `더 보기` 로 편다. 버튼은 행 면을 덮는 늘린 링크(`::after`) 위에 서야
 * 눌리므로 `z-10` 이다 — 시간 칩과 같은 로컬 레이어다.
 */
export function PlanItemMemo({ memo, title, edit }: PlanItemMemoProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <PlanItemMemoText
      memo={memo}
      title={title}
      edit={edit}
      expanded={expanded}
      onToggle={() => setExpanded((previous) => !previous)}
    />
  )
}

/** 상태를 밖에서 받는 표시부 — node 환경 테스트가 펼친 갈래까지 렌더하려고 나눴다 */
export function PlanItemMemoText({
  memo,
  title,
  edit,
  expanded,
  onToggle,
}: PlanItemMemoProps & { expanded: boolean; onToggle: () => void }) {
  const bodyId = useId()
  const collapsed = memo.collapse !== 'none' && !expanded

  return (
    <div className="mt-1 flex flex-col items-start">
      <p
        id={bodyId}
        className={cn(
          'text-body-2 text-fg-muted break-words whitespace-pre-line',
          collapsed && 'line-clamp-2',
          // 넓은 폭이면 두 줄에 들어오는 길이다 — 거기서는 접지 않는다
          collapsed && memo.collapse === 'mobile' && 'md:line-clamp-none',
        )}
      >
        {memo.text}
      </p>

      {/*
        **`더 보기` 와 `메모 수정` 을 한 줄에 둔다** (#1460 · D30-1). 메모를 읽은 자리에서 바로 고친다 —
        행마다 서는 버튼이라 ghost 로 캡션 톤에 머문다. `-ml-3` 은 ghost 좌우 여백만큼 당겨 첫
        버튼 글자를 메모 첫 글자에 맞춘다(시간 칩과 같은 판단).
      */}
      {(memo.collapse !== 'none' || edit !== undefined) && (
        <div className="-ml-3 flex flex-wrap items-center">
          {memo.collapse !== 'none' && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls={bodyId}
              aria-label={fillTemplate(
                expanded ? messages.plan.itemMemoLessLabel : messages.plan.itemMemoMoreLabel,
                { title },
              )}
              onClick={onToggle}
              // 넓은 폭에서 접지 않는 길이면 버튼도 없다 — 눌러도 아무 일이 없는 버튼이 된다
              className={cn('z-10', memo.collapse === 'mobile' && 'md:hidden')}
            >
              {expanded ? messages.plan.itemMemoLess : messages.plan.itemMemoMore}
            </Button>
          )}
          {edit !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              aria-haspopup="dialog"
              data-plan-memo-edit={edit.focusKey}
              aria-label={fillTemplate(messages.plan.itemMemoEditLabel, { title })}
              onClick={edit.onOpen}
              // 늘린 링크(`::after`) 위에 서야 눌린다 — 시간 칩 · `더 보기` 와 같은 로컬 레이어
              className="z-10"
            >
              {messages.plan.itemMemoEdit}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
