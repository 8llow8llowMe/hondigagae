'use client'

import { Button, ButtonLink } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

export type AiPlanCommitPanelProps = {
  title: string
  errors: FormErrors
  submitting: boolean
  /** `PLAN_004` 로 막혔는가 — 빼고 담기를 제안한다 (명세 S5 함정 3) */
  delistedBlocked: boolean
  /** 빼기로 표시한 항목 수. 0 이면 안내를 내지 않는다 */
  excludedCount: number
  onTitleChange: (title: string) => void
  onSubmit: () => void
  onExcludeDelisted: () => void
  onResetExcluded: () => void
  onDiscard: () => void
  /** `조건 바꾸기`/`전체 다시 만들기` 목적지 */
  againHref: string
}

/**
 * 담기 — 아트보드 03 하단 바.
 *
 * **`담기` 가 곧 `POST /plans` 다.** AI 는 제안만 하고 저장·확정은 plan-service 가
 * 한다 (명세 S5). 그래서 세 갈래를 둔다: 담기 / 전체 다시 만들기 / 버리기.
 *
 * **제목 기본값을 미리 채워 두고 고칠 수 있게 한다** (명세 S8 미결 1 — 추천 ②).
 * 초안에 제목이 없고 `POST /plans` 의 `title` 은 필수인데, 빈 칸을 마주하게 하지 않는다.
 */
export function AiPlanCommitPanel({
  title,
  errors,
  submitting,
  delistedBlocked,
  excludedCount,
  onTitleChange,
  onSubmit,
  onExcludeDelisted,
  onResetExcluded,
  onDiscard,
  againHref,
}: AiPlanCommitPanelProps) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="border-border flex flex-col gap-4 border-t px-4 py-5 md:px-10"
    >
      {/*
        **`PLAN_004` 안내와 폼 오류를 겹쳐 내지 않는다.** 서버 문구("일부 장소를 담을
        수 없습니다")와 아래 전용 블록이 같은 말을 두 번 하게 된다.
      */}
      <FormAlert message={delistedBlocked ? null : errors.form} />

      {/*
        `PLAN_004` — 초안의 장소가 그 사이 delisting 되면 저장 전체가 실패한다.
        **초안을 버리지 않고** 해당 항목만 빼고 다시 담을 수 있게 한다.
        **`다시 시도` 를 주지 않는다** — 같은 본문을 다시 보내면 같은 400 이다.
      */}
      {delistedBlocked && (
        <div className="bg-danger-100 flex flex-col items-start gap-2 rounded-md px-3 py-3">
          <p className="text-body-2 text-danger-700 font-semibold">
            {messages.aiPlan.commitDelistedTitle}
          </p>
          <p className="text-body-2 text-danger-700">{messages.aiPlan.commitDelistedDescription}</p>
          <Button variant="secondary" size="sm" onClick={onExcludeDelisted}>
            {messages.aiPlan.commitDelistedAction}
          </Button>
        </div>
      )}

      {excludedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-caption text-fg-muted tabular-nums">
            {messages.aiPlan.commitExcludedNotice.replace('{count}', String(excludedCount))}
          </p>
          <Button variant="ghost" size="sm" onClick={onResetExcluded}>
            {messages.aiPlan.commitExcludedReset}
          </Button>
        </div>
      )}

      <Field
        id="title"
        label={messages.aiPlan.commitFieldTitle}
        required
        error={errors.fields.title}
      >
        <Input
          id="title"
          value={title}
          onValueChange={onTitleChange}
          invalid={errors.fields.title !== undefined}
          maxLength={60}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={submitting}>
          {messages.aiPlan.commitSubmit}
        </Button>
        <p className="text-caption text-fg-muted">{messages.aiPlan.commitHint}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={againHref} variant="secondary">
          {messages.aiPlan.commitAgain}
        </ButtonLink>
        {/* 버리기는 되돌릴 수 없어 확인을 받는다 — 확인 모달은 호출부가 띄운다 */}
        <Button variant="ghost" onClick={onDiscard}>
          {messages.aiPlan.commitDiscard}
        </Button>
      </div>
    </form>
  )
}
