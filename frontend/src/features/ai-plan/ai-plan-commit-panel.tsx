import { Button, ButtonLink } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type AiPlanCommitPanelProps = {
  title: string
  errors: FormErrors
  submitting: boolean
  /** `PLAN_004` 로 막혔는가 — 빼고 담기를 제안한다 (명세 S5 함정 3) */
  delistedBlocked: boolean
  /**
   * 보강이 404 를 낸 항목이 있는가. **없으면 "빼고 담기" 를 주지 않는다** — 뺄 것이
   * 없는데 누르면 같은 본문을 다시 보내 같은 400 이 된다.
   */
  hasDelisted: boolean
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
 *
 * **액션이라 카드가 아니다** (`DESIGN.md §0`, #473) — 초안 카드들 아래, L0 바닥 위에 선다
 * (#443 장소 상세 · #447 일정 상세 · #451 하루 재생성의 "액션 바는 카드가 아니다" 와 같은
 * 판단). `Surface` 로 감싸면 초안과 같은 무게가 되어, 카드 넷 중 어느 것이 "이제 할 일"
 * 인지가 사라진다.
 *
 * **자리를 스스로 정하지 않는다.** 예전에는 `AiPlanDraftPreview` 의 `footer` 로 들어가
 * 미리보기 안에서 그려졌는데, 지금은 담는 쪽(`AiPlanJobView`)이 `SurfaceStack` 의 직접
 * 자식으로 세운다 — 배치 책임이 담는 쪽에 있다 (#464 가 `PetForm` 의 `footer` 를 걷은 것과
 * 같은 이동). 그래야 카드 사이 간격(모바일 8 / 데스크톱 24)을 스택이 이 블록에도 준다.
 */
export function AiPlanCommitPanel({
  title,
  errors,
  submitting,
  delistedBlocked,
  hasDelisted,
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
      /*
        **위 구분선을 걷었다.** 3a 에서는 카드 사이 틈으로 비치는 L0 이 그 일을 한다 —
        선을 남기면 마지막 일자 카드의 테두리와 나란히 두 줄로 읽힌다 (#451
        `PlanDayRegenerateConfirm` 과 같은 처리). 위 여백도 스택의 간격이 주므로 아래만
        남긴다. 인셋은 카드 안 글줄과 같은 축이라 폼이 위 카드의 첫 글자와 세로선을 맞춘다.
      */
      className={cn('flex flex-col gap-4 pb-4 md:pb-0', INSET_CLASS.card)}
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
          <p className="text-body-2 text-danger-700">
            {hasDelisted
              ? messages.aiPlan.commitDelistedDescription
              : messages.aiPlan.commitDelistedUnknown}
          </p>
          {/*
            **뺄 항목을 짚지 못하면 CTA 를 주지 않는다.** `delistedPlaceIds` 는 항목
            보강이 **404** 를 낸 곳만 모으는데, `PLAN_004` 는 plan-service 의
            `verifyPlaceTargets` 가 걸러낸 경우에도 온다 — 그때는 tour-service 상세가
            200 이라 짚을 수 없다. 빈 Set 으로 "빼고 담기" 를 누르면 배너만 사라지고
            **같은 본문 재전송 → 같은 400** 이다. 위 주석과 정확히 반대가 된다.
          */}
          {hasDelisted && (
            <Button variant="secondary" size="sm" onClick={onExcludeDelisted}>
              {messages.aiPlan.commitDelistedAction}
            </Button>
          )}
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

      {/*
        **판정 기준 반려견 라디오가 여기 있었다** (#128 · 명세 D4). `PlanCreateRequest.petId`
        가 단일이던 시절, 여러 마리로 만든 초안이 저장되는 순간 한 마리가 되는 것을 사람이
        알고 고르게 하려던 컨트롤이다. #152 가 `petIds` 를 받으면서 걷었다 (#174) —
        이제 동반한 아이가 전부 저장되고 조건 입력에서 체크한 순서가 그대로 간다.
      */}

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
