'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { DateField } from '@/components/date-field'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import { AiPlanDetailsDisclosure } from '@/features/ai-plan/ai-plan-details-disclosure'
import { AiPlanOptionsSection } from '@/features/ai-plan/ai-plan-options-section'
import { PetCheckboxGroup } from '@/features/ai-plan/pet-checkbox-group'
import { SIGUNGU_CODES, SIGUNGU_LABEL } from '@/features/place/filter-labels'
import { BUDGET_PRESETS_MANWON } from '@/lib/ai-plan/budget'
import { type DetailsInput, detailsSummary, hasAnyDetail } from '@/lib/ai-plan/details'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { describePet } from '@/lib/pet/describe'
import type { AiPlanFormValues } from '@/types/ai-plan'
import type { Pet } from '@/types/pet'

export type AiPlanCreateFormProps = {
  values: AiPlanFormValues
  errors: FormErrors
  pets: Pet[]
  /** 기간을 다 고르면 일수를 말해 준다. 못 세면 null */
  totalDays: number | null
  submitting: boolean
  /** 제출이 실패로 끝난 횟수. 포커스 이동의 **유일한 안정적인 트리거**다 */
  submitCount: number
  firstErrorField: string | null
  /**
   * 저장한 장소 개수. `null` 은 "아직 모른다" 이고 `0` 과 다르다 (#128) —
   * `AiPlanOptionsSection` 의 같은 이름 prop 주석 참고.
   */
  favoriteCount: number | null
  /** `'YYYY-MM-DD'`. 서버가 내려보낸 오늘 — 달력의 오늘 표시에 쓴다 */
  today: string
  onValueChange: <K extends keyof AiPlanFormValues>(key: K, value: AiPlanFormValues[K]) => void
  onOpenPlacePicker: () => void
  onSubmit: () => void
}

/**
 * AI 일정 조건 입력 폼 — 아트보드 01 · 04 좌측 레일.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 *
 * **정말 필수인 것은 기간·반려견 둘뿐이다.** 나머지 다섯(지역 · 예산 · 저장한 곳 우선 ·
 * 꼭 넣을 곳)은 기본값이 있어 「더 자세히 정할게요」 접기 안에 있다. 자유 요청만 접기
 * 밖에 남는데, 기본값이 없고 결과 품질에 가장 크게 기여하는 입력이기 때문이다.
 */
export function AiPlanCreateForm({
  values,
  errors,
  pets,
  totalDays,
  submitting,
  submitCount,
  firstErrorField,
  favoriteCount,
  today,
  onValueChange,
  onOpenPlacePicker,
  onSubmit,
}: AiPlanCreateFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const details: DetailsInput = {
    /*
      **`?? fieldRegionAll` 을 뺄 수 없다.** `tsconfig` 가 `noUncheckedIndexedAccess: true`
      이고 `SIGUNGU_LABEL` 이 `Record<string, string>` 이라, 인덱스 접근의 타입은
      `string | undefined` 다. 빼면 typecheck 가 깨진다.
    */
    regionLabel:
      values.sigunguCode === null
        ? messages.aiPlan.fieldRegionAll
        : (SIGUNGU_LABEL[values.sigunguCode] ?? messages.aiPlan.fieldRegionAll),
    regionNarrowed: values.sigunguCode !== null,
    budgetManwon: values.budgetManwon,
    preferFavorites: values.preferFavorites,
    pinnedCount: values.pinnedPlaces.length,
  }

  /*
    **마운트 시 1회만 판정한다.** 지연 초기화로 첫 값을 정하고 그 뒤로는 사용자의 토글만
    듣는다. `hasAnyDetail(details)` 를 매 렌더 읽으면 **마지막 값을 지우는 순간 입력 중인
    섹션이 접힌다** — `restoreValues` 가 `sessionStorage` 를 지연 초기화로 읽는 것과 같은
    이유다 (`ai-plan-create-view.tsx`).

    `?from={jobId}` 로 돌아온 사람에게 자기가 넣었던 예산이 접혀 있으면 사라진 것처럼 보인다.
  */
  const [detailsOpen, setDetailsOpen] = useState(() => hasAnyDetail(details))

  /*
    **접힌 섹션 안의 필드에서 오류가 나면 먼저 펼친다.** 안 그러면 제출이 조용히 실패한다 —
    포커스를 옮길 요소가 마운트돼 있지 않고, 오류 메시지도 화면에 없다.

    `submitCount` 를 트리거로 쓴다 (`errors` 를 쓰면 입력 중에 다시 돈다 —
    `use-form.ts` 의 `submitCount` JSDoc).

    **아래 포커스 effect 보다 먼저 선언한다.** 다만 순서만으로 포커스까지 살아나지는
    않는다 — 두 effect 는 같은 커밋에서 연달아 돌고, 여기서 부른 `setDetailsOpen` 이
    만든 재렌더는 그 뒤에 온다. 즉 아래 effect 가 `querySelector` 할 때 패널은 아직
    마운트 전이다. **이 effect 가 지키는 것은 "오류가 화면에 보인다" 까지다** —
    포커스가 접힌 필드에 닿게 하려면 `detailsOpen` 을 아래 effect 의 의존성에
    더해야 하는데, 그러면 사용자가 접기를 여닫을 때마다 포커스를 훔친다.
  */
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    if (firstErrorField === 'budgetManwon' || firstErrorField === 'pinnedPlaces') {
      setDetailsOpen(true)
    }
  }, [submitCount, firstErrorField])

  /*
    제출 실패 시 첫 오류 필드로 포커스를 옮긴다. `errors` 를 의존성으로 쓰면 입력 중인
    필드에서 포커스를 훔친다 (`use-form.ts` 의 `submitCount` JSDoc).

    라디오 그룹은 `id` 로 찾을 수 없어 `[name]` 을 함께 본다 (`PlanCreateForm` 과 동일).
  */
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    const target = formRef.current?.querySelector<HTMLElement>(
      `[id="${firstErrorField}"], [name="${firstErrorField}"]`,
    )
    target?.focus()
  }, [submitCount, firstErrorField])

  const budgetSelected = values.budgetManwon.trim()

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <FormAlert message={errors.form} />

      {/*
        **정말 답해야 하는 둘이 맨 위다** — 기간과 반려견. 나머지 다섯은 기본값이 있어
        접기 안으로 들어갔고, 그래서 `필수 항목` `<h3>` 을 지웠다: "필수 vs 선택" 이
        접기라는 구조로 이미 드러나므로 라벨이 같은 말을 한 번 더 하는 셈이 된다.
      */}
      <div className="flex flex-col gap-5">
        {/*
          두 날짜는 한 줄에 나란히 — 기간은 하나의 값이다.

          **`<input type="date">` 가 아니라 `DateField` 다.** 네이티브 날짜 입력을
          쓰지 않는 이유는 `date-field.tsx` 주석에 있다. 여기서 중요한 것은
          `rangeStart`/`rangeEnd` 를 **두 달력에 똑같이** 넘기는 것이다 — 시작일을
          고르는 중에도 이미 고른 종료일이 띠로 보여야 며칠 일정인지 그 자리에서 읽힌다.
        */}
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
          <Field
            id="startDate"
            label={messages.aiPlan.fieldStartDate}
            required
            error={errors.fields.startDate}
            className="flex-1"
          >
            <DateField
              id="startDate"
              label={messages.aiPlan.fieldStartDate}
              placeholder={messages.aiPlan.datePlaceholder}
              today={today}
              value={values.startDate}
              onValueChange={(startDate) => onValueChange('startDate', startDate)}
              invalid={errors.fields.startDate !== undefined}
              rangeStart={values.startDate}
              rangeEnd={values.endDate}
            />
          </Field>

          <Field
            id="endDate"
            label={messages.aiPlan.fieldEndDate}
            required
            error={errors.fields.endDate}
            className="flex-1"
          >
            <DateField
              id="endDate"
              label={messages.aiPlan.fieldEndDate}
              placeholder={messages.aiPlan.datePlaceholder}
              today={today}
              value={values.endDate}
              onValueChange={(endDate) => onValueChange('endDate', endDate)}
              invalid={errors.fields.endDate !== undefined}
              // 시작일보다 이른 날짜는 달력에서 아예 고를 수 없다. 스키마의 refine 은
              // 조건을 되살리는 경로(`?from={jobId}`)를 위한 2차 방어로 남는다
              min={values.startDate === '' ? null : values.startDate}
              rangeStart={values.startDate}
              rangeEnd={values.endDate}
            />
          </Field>
        </div>

        {totalDays !== null && (
          <p className="text-caption text-fg-muted tabular-nums">
            {messages.aiPlan.periodSummary.replace('{days}', String(totalDays))}
          </p>
        )}
      </div>

      {/*
        안내는 그룹 바로 아래 8px 이다. 앞서 `-mt-3` 으로 위 여백을 되돌려 붙이고
        있었는데, 그 값은 부모의 `gap-5` 를 상쇄하려던 것이라 부모가 바뀌면 어긋난다 —
        그룹과 안내를 한 상자에 넣어 간격을 직접 준다.
      */}
      <div className="flex flex-col gap-2">
        <PetCheckboxGroup
          id="petIds"
          label={messages.aiPlan.fieldPet}
          required
          options={pets.map((pet) => ({
            value: pet.petId,
            label: pet.name,
            description: describePet(pet),
          }))}
          values={values.petIds}
          onValuesChange={(petIds) => onValueChange('petIds', petIds)}
          error={errors.fields.petIds}
        />
        <p className="text-caption text-fg-muted">{messages.aiPlan.fieldPetHint}</p>
      </div>

      {/*
        자유 입력은 **접기 밖에 남는다.** 기본값이 없고 결과 품질에 가장 크게 기여하는
        입력이라, 접으면 아무도 쓰지 않는다.

        다만 **필수 둘보다는 뒤다.** 맨 위에 두면 빈 칸이 화면을 열어 "뭘 써야 하지" 에서
        막힌다 (아트보드 01 주석) — 기간·반려견을 먼저 답하고 나면 쓸 말이 생긴다.
      */}
      <Field
        id="requestNote"
        label={messages.aiPlan.fieldNote}
        hint={messages.aiPlan.fieldNoteHint}
        error={errors.fields.requestNote}
      >
        <Textarea
          id="requestNote"
          rows={3}
          value={values.requestNote}
          onValueChange={(requestNote) => onValueChange('requestNote', requestNote)}
          invalid={errors.fields.requestNote !== undefined}
          placeholder={messages.aiPlan.fieldNotePlaceholder}
          maxLength={500}
        />
      </Field>

      {/*
        **기본값이 있는 다섯을 여기로 모은다** — 지역 · 예산 · 저장한 곳 우선 · 꼭 넣을 곳.
        전부 안 건드려도 일정이 만들어지므로, 펼쳐 두면 "해야 할 일" 로 읽혀 실제로
        답해야 하는 둘을 가린다. 접힌 줄이 무엇으로 만들어지는지 대신 말해 준다.
      */}
      <AiPlanDetailsDisclosure
        open={detailsOpen}
        summary={detailsSummary(details)}
        onToggle={() => setDetailsOpen((open) => !open)}
      >
        {/*
          지역 좁히기 (#251 · 아트보드 01). 계약에 `sigunguCode` 가 없던 동안에는
          "제주 전체에서 찾아요." 한 줄이 이 자리에 있었다.

          **`제주 전체` 를 첫 칩으로 둔다.** 기본값이고, 빼면 "안 고른 상태" 를 되돌릴
          방법이 없어진다 — 한 번 좁히면 전체로 못 돌아온다.

          **예산 칩과 같은 `gap-2.5`** 다. 필터 칩(6px)이 아니라 폼 컨트롤이라
          아트보드가 다른 값을 준다 (아래 예산 블록 주석과 같은 이유).
        */}
        <fieldset className="flex flex-col gap-1">
          {/*
            **라벨이 눈에 보여야 한다.** 예산 칩은 바로 아래 `Field`(예산 (선택))가 라벨을
            들고 있어 `ChipGroup` 의 `aria-label` 만으로 충분했지만, 이 축은 칩이 컨트롤의
            전부다 — 라벨이 없으면 접기를 펼쳤을 때 무엇을 고르는 칩인지 알 수 없다.
            `PetCheckboxGroup` 의 `legend` 와 같은 값이다.
          */}
          <legend className="text-body-2 text-fg mb-1 font-medium">
            {messages.aiPlan.fieldRegion}
          </legend>

          <ChipGroup
            label={messages.aiPlan.fieldRegion}
            exclusive
            className="flex flex-wrap gap-2.5"
          >
            <Chip
              exclusive
              selected={values.sigunguCode === null}
              onSelect={() => onValueChange('sigunguCode', null)}
            >
              {messages.aiPlan.fieldRegionAll}
            </Chip>
            {SIGUNGU_CODES.map((code) => (
              <Chip
                key={code}
                exclusive
                selected={values.sigunguCode === code}
                onSelect={() => onValueChange('sigunguCode', code)}
              >
                {SIGUNGU_LABEL[code]}
              </Chip>
            ))}
          </ChipGroup>

          <p className="text-caption text-fg-muted mt-1">{messages.aiPlan.fieldRegionHint}</p>
        </fieldset>

        {/*
          예산은 **칩 + 직접 입력**이다 (아트보드 01 주석: 대부분 어림값을 고른다).
          "상관없음" 은 빈 값이고 `0` 이 아니다 — 계약이 `@Positive` 다 (명세 S1).
        */}
        <div className="flex flex-col gap-2">
          {/*
            **레이아웃 클래스를 여기서 준다.** `ChipGroup` 은 role/aria 배선만 하고
            배치를 사용처에 맡긴다 (`place-filter-chips.tsx` 와 같은 규약).

            **간격만 다르다 — `gap-2.5`(10px) 는 아트보드 값이다.** 필터 칩
            (`place-filter-chips` · `emergency-section`)은 `gap-1.5`(6px)를 쓰는데,
            그쪽은 여러 줄로 빽빽하게 깔리는 필터 줄이고 이쪽은 한 줄짜리 폼 컨트롤이라
            정본이 애초에 다른 값을 준다. **규약이 같다고 값까지 맞추지 않는다** —
            맞추면 아트보드에서 멀어진다 (#96 이 필터 쪽 3곳을 6px 로 통일한 것과
            이 값은 별개다).
          */}
          <ChipGroup
            label={messages.aiPlan.budgetPresetLabel}
            exclusive
            className="flex flex-wrap gap-2.5"
          >
            {BUDGET_PRESETS_MANWON.map((preset) => (
              <Chip
                key={preset}
                exclusive
                selected={budgetSelected === String(preset)}
                onSelect={() => onValueChange('budgetManwon', String(preset))}
              >
                {`${preset}${messages.aiPlan.fieldBudgetUnit}`}
              </Chip>
            ))}
            <Chip
              exclusive
              selected={budgetSelected === ''}
              onSelect={() => onValueChange('budgetManwon', '')}
            >
              {messages.aiPlan.budgetAny}
            </Chip>
          </ChipGroup>

          <Field
            id="budgetManwon"
            label={messages.aiPlan.fieldBudget}
            hint={messages.aiPlan.fieldBudgetHint}
            error={errors.fields.budgetManwon}
          >
            <div className="flex items-center gap-2">
              <Input
                id="budgetManwon"
                // text 다 — number 는 휠 스크롤로 값이 바뀌고 빈 값과 잘못된 값을
                // 구분하지 못한다. 숫자 키패드는 inputMode 가 연다
                inputMode="numeric"
                value={values.budgetManwon}
                onValueChange={(budgetManwon) => onValueChange('budgetManwon', budgetManwon)}
                invalid={errors.fields.budgetManwon !== undefined}
                className="flex-1"
              />
              <span className="text-body-2 text-fg-muted shrink-0">
                {messages.aiPlan.fieldBudgetUnit}
              </span>
            </div>
          </Field>
        </div>

        {/*
          **생성 옵션은 접기의 맨 아래다** (아트보드 05 "입력 화면에 붙는 세 항목").
          자체 `<h3>`(`optionGroupLabel`)을 갖고 있으므로 여기서 제목을 덧붙이지 않는다.
        */}
        <AiPlanOptionsSection
          preferFavorites={values.preferFavorites}
          favoriteCount={favoriteCount}
          pinnedPlaces={values.pinnedPlaces}
          onPreferFavoritesChange={(preferFavorites) =>
            onValueChange('preferFavorites', preferFavorites)
          }
          onRemovePinned={(placeId) =>
            onValueChange(
              'pinnedPlaces',
              values.pinnedPlaces.filter((place) => place.placeId !== placeId),
            )
          }
          onOpenPicker={onOpenPlacePicker}
        />
      </AiPlanDetailsDisclosure>

      {/* 상한 2차 방어가 걸렸을 때만 나온다 — 시트가 이미 막는다 */}
      <FormAlert message={errors.fields.pinnedPlaces ?? null} />

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={submitting}>
          {messages.aiPlan.createSubmit}
        </Button>
        {/* 소요 시간과 저장 시점을 미리 말한다 — 기대를 맞춰 두면 대기 화면이 불안하지 않다 */}
        <p className="text-caption text-fg-muted">{messages.aiPlan.createSubmitHint}</p>
      </div>
    </form>
  )
}
