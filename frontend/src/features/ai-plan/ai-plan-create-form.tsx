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

/*
  **「더 자세히 정할게요」 접기 안에 있는 필드 키 넷.** 접기 안팎을 옮길 때 고칠 곳을
  한 군데로 묶어 둔다 — 아래 펼침 effect 가 이 목록을 그대로 읽는다.

  **여기서 빠진 키는 제출을 조용히 실패시킨다.** 오류가 나도 섹션이 접힌 채라 메시지도
  포커스 대상도 화면에 없다 (`docs/form-guide.md` §8). 실제로 `sigunguCode` 가 한동안
  빠져 있었다.

  `preferFavorites` 는 지금 검증 오류를 낼 수 없지만 목록에 남긴다 — 이 상수가 말하는
  것은 "오류 키" 가 아니라 "접기 안에 있는 것" 이고, 그 답은 넷이다
  (`docs/features/ai-plan/공통명세.md`).
*/
const COLLAPSED_FIELDS: ReadonlySet<string> = new Set([
  'sigunguCode',
  'budgetManwon',
  'preferFavorites',
  'pinnedPlaces',
])

/**
 * AI 일정 조건 입력 폼 — 아트보드 01 · 04 좌측 레일.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 *
 * **정말 필수인 것은 기간·반려견 둘뿐이다.** 선택 항목은 다섯인데 그중 넷(지역 · 예산 ·
 * 저장한 곳 우선 · 꼭 넣을 곳)은 기본값이 있어 「더 자세히 정할게요」 접기 안에 있다.
 * 다섯째인 자유 요청만 접기 밖에 남는데, 기본값이 없고 결과 품질에 가장 크게 기여하는
 * 입력이기 때문이다.
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

  /*
    종료일 달력의 열림 상태. **시작일을 고른 순간 부모가 연다** (`DateField` 의 `open` 주석).
    그 외에는 `DateField` 가 스스로 여닫는 것과 똑같이 동작한다.
  */
  const [endDateOpen, setEndDateOpen] = useState(false)

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

    **아래 포커스 effect 보다 먼저 선언한다.** 다만 순서만으로는 포커스까지 살아나지
    않는다 — 두 effect 는 같은 커밋에서 연달아 돌고, 여기서 부른 `setDetailsOpen` 이
    만든 재렌더는 그 **뒤에** 온다. 즉 아래 effect 의 첫 `querySelector` 시점에 패널은
    아직 마운트 전이라 대상을 못 찾는다. 그 두 번째 기회는 아래 effect 가 직접 만든다
    (`focusedSubmitCountRef` 주석).
  */
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    if (COLLAPSED_FIELDS.has(firstErrorField)) {
      setDetailsOpen(true)
    }
  }, [submitCount, firstErrorField])

  /*
    **이미 포커스를 옮겨 준 `submitCount`.** `0` 은 "아직 아무 제출도 처리하지 않았다".

    이 ref 가 없으면 아래 effect 의 `detailsOpen` 의존성이 곧바로 버그가 된다 —
    제출 실패 뒤 오류가 남아 있는 동안 사용자가 접기를 여닫을 때마다 effect 가 다시 돌아
    **사용자가 보고 있던 곳에서 포커스를 훔친다** (`use-form.ts` 의 `submitCount` JSDoc 이
    `errors` 를 의존성에서 뺀 것과 같은 문제의 변종이다). ref 로 "이 제출은 이미 처리했다"
    를 기억해 두면 그 뒤의 토글은 전부 조용히 빠져나간다.

    **소비 시점이 핵심이다 — 대상을 찾았을 때만 소비한다.** 접힌 섹션 안의 필드
    (`COLLAPSED_FIELDS`)에서 오류가 나면 첫 패스는 패널이 마운트되기 전이라
    `querySelector` 가 빈손으로 끝난다. 여기서 소비해 버리면 그걸로 끝이고, 위 펼침
    effect 의 `setDetailsOpen(true)` 가 만든 재렌더에서 `detailsOpen` 이 바뀌어 effect 가
    한 번 더 돌 때 가드에 막힌다. 못 찾았으면 소비하지 않고 두어 **두 번째 패스가
    성공하게** 만든다. 그 두 번째 패스가 소비를 끝내므로 이후의 수동 토글은 다시
    포커스를 옮기지 않는다.

    **단 `pinnedPlaces` 와 `sigunguCode` 는 예외다** — 그 키를 `id`/`name` 으로 다는 요소가
    아예 없다(담긴 곳은 목록이고 지역은 칩 그룹이다). 두 번째 패스도 빈손이라 ref 는 끝내
    소비되지 않고, 이후 토글마다 `querySelector` 가 한 번씩 헛돌기만 한다 — 못 찾으면
    그대로 빠져나가므로 포커스를 훔치지도, 옮기지도 않는다. **이 두 키에서 실제로 일하는
    것은 위 펼침 effect 뿐이다**: 섹션을 열어 오류 메시지를 화면에 올리는 데서 끝난다.

    ⚠️ 이 ref 를 "불필요한 상태" 로 보고 지우면 접힌 필드의 포커스 이동
    (`docs/form-guide.md` §8)이 조용히 깨지거나 토글이 포커스를 훔친다. 이 저장소의
    렌더 테스트는 effect 를 돌리지 않아 **둘 다 테스트가 잡아 주지 않는다.**
  */
  const focusedSubmitCountRef = useRef(0)

  /*
    제출 실패 시 첫 오류 필드로 포커스를 옮긴다. `errors` 를 의존성으로 쓰면 입력 중인
    필드에서 포커스를 훔친다 (`use-form.ts` 의 `submitCount` JSDoc).

    `detailsOpen` 이 의존성에 있는 것은 위 두 번째 패스 때문이다 — 재실행 자체는
    `focusedSubmitCountRef` 가 걸러 준다.

    라디오 그룹은 `id` 로 찾을 수 없어 `[name]` 을 함께 본다 (`PlanCreateForm` 과 동일).
  */
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    if (focusedSubmitCountRef.current === submitCount) return
    const target = formRef.current?.querySelector<HTMLElement>(
      `[id="${firstErrorField}"], [name="${firstErrorField}"]`,
    )
    if (target === null || target === undefined) return
    focusedSubmitCountRef.current = submitCount
    target.focus()
  }, [submitCount, firstErrorField, detailsOpen])

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
        **정말 답해야 하는 둘이 맨 위다** — 기간과 반려견. 선택 다섯 중 넷은 기본값이
        있어 접기 안으로 들어갔고(자유 요청만 밖에 남는다), 그래서 `필수 항목` `<h3>` 을
        지웠다: "필수 vs 선택" 이 접기라는 구조로 이미 드러나므로 라벨이 같은 말을 한 번
        더 하는 셈이 된다.
      */}
      <div className="flex flex-col gap-5">
        {/*
          두 날짜는 한 줄에 나란히 — 기간은 하나의 값이다.

          **`<input type="date">` 가 아니라 `DateField` 다.** 네이티브 날짜 입력을
          쓰지 않는 이유는 `date-field.tsx` 주석에 있다. 여기서 중요한 것은
          `rangeStart`/`rangeEnd` 를 **두 달력에 똑같이** 넘기는 것이다 — 시작일을
          고르는 중에도 이미 고른 종료일이 띠로 보여야 며칠 일정인지 그 자리에서 읽힌다.
        */}
        {/*
        **시작일을 고르면 종료일 달력이 이어서 열린다** — 기간은 두 번 고르는 하나의 값이라
        중간에 한 번 더 누르게 할 이유가 없다. 두 필드를 하나의 기간 선택으로 합치지 않기로
        한 결정(#162)은 그대로 두고, 합쳤을 때 얻는 흐름만 가져온다.

        **종료일이 비어 있을 때만 연다.** 이미 잡은 일정의 시작일만 하루 미루는 것은 흔한
        조작인데, 그때도 달력이 튀어나오면 참견이 된다.
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
              onValueChange={(startDate) => {
                onValueChange('startDate', startDate)
                /*
                  **종료일보다 늦은 시작일을 고르면 종료일을 비우고 다시 받는다.**
                  시작일에는 `max` 를 걸지 않는다 — 걸면 기간을 통째로 뒤로 옮기려는 사람이
                  종료일부터 고쳐야 하고, 그 순서를 화면이 알려 줄 방법이 없다. 대신 어긋난
                  순간 종료일만 비워 다시 묻는다. 남겨 두면 스키마가 제출에서 막는 값이
                  화면에는 멀쩡해 보인다.
                */
                if (values.endDate !== '' && startDate > values.endDate) {
                  onValueChange('endDate', '')
                  setEndDateOpen(true)
                } else if (values.endDate === '') {
                  setEndDateOpen(true)
                }
              }}
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
              open={endDateOpen}
              onOpenChange={setEndDateOpen}
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
        **기본값이 있는 넷을 여기로 모은다** — 지역 · 예산 · 저장한 곳 우선 · 꼭 넣을 곳
        (`COLLAPSED_FIELDS`).
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

          **예산 칩과 같은 `gap-2`** 다. 필터 칩(6px)과는 여전히 갈라져 있다 —
          근거는 아래 예산 블록 주석에 있다.
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

          <ChipGroup label={messages.aiPlan.fieldRegion} exclusive className="flex flex-wrap gap-2">
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

            **간격은 `gap-2`(8px)다.** 필터 칩(`place-filter-chips` · `emergency-section`)은
            `gap-1.5`(6px)를 쓰는데, 그쪽은 여러 줄로 빽빽하게 깔리는 필터 줄이고 이쪽은
            폼 컨트롤이라 **여전히 갈라져 있다** — 규약이 같다고 값까지 맞추지 않는다
            (#96 이 필터 쪽 3곳을 6px 로 통일한 것과 이 값은 별개다).

            **아트보드는 이 자리에 10px 을 줬고, 그것을 §4 스케일의 8 로 내렸다** (#335).
            아트보드가 `DESIGN.md` §4 의 출처지만 **정본은 §4 다** — "아트보드가 그랬다" 가
            이기면 스케일은 어디에서도 권위를 갖지 못하고, `token-usage.test.ts` 가 그
            권위를 지키려고 존재한다. 2px 은 이 자리에서 보이지 않지만, **한 폼의 칩 줄만
            제품의 다른 모든 칩 줄과 다른 간격을 쓰는 것**은 화면을 옮겨 다닐 때 보인다.
            6 으로 내리는 쪽은 #339 에서 시도했다가 되돌렸다(필터 칩과 같아진다) —
            8 은 "폼 컨트롤이 필터 칩보다 조금 넉넉하다" 는 뜻을 지키면서 스케일 안에 있는
            유일한 값이다.
          */}
          <ChipGroup
            label={messages.aiPlan.budgetPresetLabel}
            exclusive
            className="flex flex-wrap gap-2"
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
          자체 `<h4>`(`optionGroupLabel`)을 갖고 있으므로 여기서 제목을 덧붙이지 않는다 —
          카드 `h2` → 접기 머리글 `h3` → 이 구역 `h4` 순이다 (#473).
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
