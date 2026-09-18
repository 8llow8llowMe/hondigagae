'use client'

import { useEffect, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { CheckboxGroup } from '@/components/checkbox-group'
import { DateField } from '@/components/date-field'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { Modal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { petKeys } from '@/features/pet/queries'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { updatePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors, NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { describePet } from '@/lib/pet/describe'
import { planEditPetIds, toPlanUpdatePayload, validatePlanEdit } from '@/lib/plan/edit'
import type { Pet } from '@/types/pet'
import type { PlanDetail } from '@/types/plan'

/** 서버가 동행견 수정을 거절하는 두 갈래. 문구는 서버 것을 그대로 쓴다 (D13-1) */
const PET_NOT_OWNED = 'PLAN_011'
const PLAN_ALREADY_COMPLETED = 'PLAN_019'

/**
 * 이름 · 기간 · 예산 · 동행 반려견 수정 — 아트보드 01·02 의 더보기 메뉴.
 *
 * **입력이 있는 다이얼로그라 `ConfirmModal` 이 아니라 `Modal` 을 쓴다** (#79 에서 추출).
 * `role` 기본값이 `dialog` 다 — `alertdialog` 는 되돌릴 수 없는 확인 전용이다.
 *
 * **기간을 여기서 바꾼다** (#585). 예전에는 닫아 뒀는데, 그 근거였던 고아 항목은 서버가
 * `PLAN_008` 로 거부하면서 사라졌다 (`types/plan.ts` 의 `PlanUpdatePayload` 주석).
 * 그 대신 저장이 **거부될 수 있는 폼**이 됐으므로, 막힐 수 있다는 것을 힌트로 미리 말하고
 * 실제 거부는 서버 문구를 폼 배너로 그대로 띄운다 — 어느 일차에 항목이 있는지 화면이
 * 다시 세어 판정을 복제하지 않는다.
 *
 * **동행견도 여기서 바꾼다** (#622 · 명세 D13). 새 모달을 만들지 않은 이유는 메뉴 항목을
 * 늘리지 않으려는 것이고, **기간 바로 아래**에 두는 이유는 만들기 폼이 `기간 → 반려견`
 * 순서로 묻도록 #400 이 맞춰 뒀기 때문이다 (`features/plan/form-order.test.ts`).
 *
 * **완료 일정에서는 그 그룹이 없다.** 서버가 `PLAN_019` 로 거절하므로 누를 수 있는
 * 컨트롤을 두고 저장에서 되돌려 보내면 화면이 거짓말을 한 것이 된다. 숨기는 것만으로
 * 막지 않고 **페이로드 변환에서 한 번 더 잠근다** (`toPlanUpdatePayload` 의 `petsEditable`).
 */
export function PlanEditModal({
  plan,
  pets,
  today,
  open,
  onClose,
}: {
  plan: PlanDetail
  /**
   * 고를 수 있는 반려견 전체. **`PlanDetailView` 가 이미 읽은 것을 내려받는다** — 모달이
   * `usePetList` 를 또 붙이면 이 화면이 `authed` 를 알아야 하고(그 훅이 필수 인자로
   * 강제한다) 렌더도 무거워진다. 정렬은 목록 응답 순서 그대로다.
   *
   * **비면 그룹 자체를 렌더하지 않는다** — 반려견이 없는 회원과 목록 조회가 실패한 경우가
   * 같은 모양이 된다. 둘 다 "고를 수 없다" 이고, 그때도 나머지 필드는 그대로 저장된다.
   */
  pets: readonly Pet[]
  /**
   * 달력의 오늘 (`YYYY-MM-DD`). **서버가 정한 오늘을 받는다** — 클라이언트 컴포넌트가
   * `new Date()` 를 부르면 자정을 걸쳐 SSR 과 갈린다 (`lib/date/day.ts` `dayToLocalNoon`).
   */
  today: string
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [title, setTitle] = useState(plan.title)
  const [startDate, setStartDate] = useState(plan.startDate)
  const [endDate, setEndDate] = useState(plan.endDate)
  const [budget, setBudget] = useState(plan.budget === null ? '' : String(plan.budget))
  const [petIds, setPetIds] = useState(() => planEditPetIds(plan.petIds, pets))
  const [errors, setErrors] = useState(NO_FORM_ERRORS)
  const [saving, setSaving] = useState(false)
  /*
    종료일 달력의 열림 상태. **시작일을 고른 순간 종료일이 비면 이어서 연다** — 만들기
    폼과 같은 흐름이다 (`plan-create-form.tsx`). 다만 이 폼은 두 날짜가 **이미 채워진 채로
    열리므로** 실제로 이어 열리는 경우는 시작일이 종료일을 넘겨 종료일을 비웠을 때뿐이다.
  */
  const [endDateOpen, setEndDateOpen] = useState(false)
  // disabled 반영 전 빠른 연속 제출을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  /*
    **동행견 그룹이 폼에 있는가.** 완료 일정은 서버가 `PLAN_019` 로 거절하고(D13-3),
    고를 반려견이 없으면 그룹을 세울 수 없다(D13-2). 이 값이 그대로 변환에도 들어가
    화면과 페이로드가 같은 사실을 본다.
  */
  const petsEditable = plan.status.code !== 'COMPLETED' && pets.length > 0
  /* 초기 선택은 **옵션에 있는 것만** — 삭제된 아이의 잔여 id 는 여기서 빠진다 (D13-4) */
  const initialPetIds = planEditPetIds(plan.petIds, pets)
  /*
    아래 effect 의 deps 는 **배열이 아니라 이 문자열**이다. 부모가 `pets={pets.data?.pets ?? []}`
    로 내려주므로 목록이 아직 없을 때 매 렌더 새 배열이 온다 — 배열 식별자를 deps 에 두면
    effect 가 렌더마다 돌아 **입력 중이던 값을 지운다.** 내용이 같으면 돌지 않아야 한다.
  */
  const initialPetKey = initialPetIds.join(',')

  // 열 때마다 서버 값으로 되돌린다 — 이전에 취소한 입력이 남아 있으면 안 된다
  useEffect(() => {
    if (!open) return
    setTitle(plan.title)
    setStartDate(plan.startDate)
    setEndDate(plan.endDate)
    setBudget(plan.budget === null ? '' : String(plan.budget))
    setPetIds(initialPetKey === '' ? [] : initialPetKey.split(','))
    setErrors(NO_FORM_ERRORS)
    setEndDateOpen(false)
  }, [open, plan.title, plan.startDate, plan.endDate, plan.budget, initialPetKey])

  function handleSubmit() {
    if (savingRef.current) return

    const validation = validatePlanEdit(
      { title, startDate, endDate, budget, petIds },
      { petsEditable },
    )
    if (Object.keys(validation).length > 0) {
      setErrors({ fields: validation, form: null })
      return
    }

    savingRef.current = true
    setSaving(true)
    setErrors(NO_FORM_ERRORS)

    const payload = toPlanUpdatePayload(
      { title, startDate, endDate, budget, petIds },
      { petsEditable, initialPetIds },
    )
    /*
      **키가 실제로 실렸을 때만** 동행견 토스트를 띄운다 (D13-6). 폼 값이 아니라 페이로드를
      보는 이유는 둘이 갈리기 때문이다 — 완료 일정·변경 없음이면 값은 있어도 키가 없다.
      제목만 고친 저장에 "동행견을 바꿨어요" 가 뜨면 거짓말이다.
    */
    const petsChanged = payload.petIds !== undefined

    void updatePlan(plan.planId, payload)
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(plan.planId), next)
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
        /*
          **일자별 판정을 함께 버린다** (#585). 기간이 바뀌면 일차 수와 날짜가 통째로
          달라지는데 `planKeys.weather` 캐시는 옛 기간으로 만든 것이다 — 남겨 두면 새
          기간의 화면에 옛 일자 브리핑이 붙는다. 제목·예산만 고쳤을 때도 같이 버리지만,
          그 비용은 조회 한 번이고 반대(틀린 판정을 보여 주는 것)보다 싸다.
        */
        void queryClient.invalidateQueries({ queryKey: planKeys.weather(plan.planId) })
        /*
          **산책 위험도도 같이 버린다** (#625 · D15-6). 기간이 바뀌면 일차·날짜가
          통째로 달라지고, 날짜는 판정 순서의 첫 조건(`PAST_DATE`)과 예보 지평 판정에
          바로 쓰인다 — 옛 기간으로 낸 판정을 남겨 두면 새 기간의 화면에 붙는다.
        */
        void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(plan.planId) })

        /*
          **`planKeys.packing` 은 버리지 않는다** (D13-6). 서버는 동행견을 바꿔도 저장된
          준비물을 지우지도 다시 만들지도 않으므로(`PlanCommandProcessor.java:199-201`)
          무효화해 봐야 **같은 응답이 다시 올 뿐**이다. `review`(완료 전용) · `emergency`
          (위치 기반) · `petKeys`(반려견 자체는 안 바뀐다)도 같은 이유로 건드리지 않는다.
        */

        if (petsChanged) showToast({ message: messages.plan.editPetsSaved })
        onClose()
      })
      .catch((error: unknown) => {
        /*
          `PLAN_008`(줄어든 기간 밖에 항목이 남아 있습니다)은 **검증이 아니라 도메인
          예외**라 `fieldErrors` 가 없다 — `apiErrorToFormErrors` 가 폼 배너로 올린다.
          서버 문구가 이미 "해당 일차의 항목을 먼저 정리해 주세요" 까지 말하므로 FE 가
          자기 말투로 옮기지 않는다. 동행견의 `PLAN_010`·`PLAN_011`·`PLAN_019` 도 같은
          갈래다 (D13-1).
        */
        setErrors(apiErrorToFormErrors(error, messages.plan.editError))

        if (error instanceof ApiError) {
          /*
            **거절이 "화면이 낡았다" 는 신호인 두 경우만 다시 읽는다.**

            `PLAN_011` — 내 소유가 아니거나 없는 아이가 섞였다. 옵션을 만든 반려견 목록이
            낡았다는 뜻이라 그것을 버린다. 배너 문구는 서버 것을 그대로 쓴다.
            `PLAN_019` — 다른 탭에서 이 일정이 완료됐다. 상세를 다시 읽으면 `petsEditable`
            이 `false` 가 되어 그룹이 사라진다.
          */
          if (error.resultCode === PET_NOT_OWNED) {
            void queryClient.invalidateQueries({ queryKey: petKeys.list() })
          }
          if (error.resultCode === PLAN_ALREADY_COMPLETED) {
            void queryClient.invalidateQueries({ queryKey: planKeys.detail(plan.planId) })
          }
        }
      })
      .finally(() => {
        savingRef.current = false
        setSaving(false)
      })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.plan.editTitle}
      // 입력 폼은 md. 필드가 좁으면 오히려 읽기 어렵다
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {messages.plan.editCancel}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {messages.plan.editSubmit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          id="plan-edit-title"
          label={messages.plan.fieldTitle}
          required
          {...(errors.fields.title === undefined ? {} : { error: errors.fields.title })}
        >
          <Input
            id="plan-edit-title"
            value={title}
            onValueChange={setTitle}
            invalid={errors.fields.title !== undefined}
            maxLength={60}
          />
        </Field>

        {/*
          두 날짜는 한 줄에 나란히 — 기간은 하나의 값이라 세로로 떨어뜨리면 관계가 흐려진다.
          만들기 폼과 같은 배치·같은 `rangeStart`/`rangeEnd` 전달이다.

          **시작일에 `max` 를 걸지 않는다.** 걸면 기간을 통째로 뒤로 옮기려는 사람이 종료일
          부터 고쳐야 하고, 그 순서를 화면이 알려 줄 방법이 없다 (`plan-create-form.tsx`).

          **`min={today}` 도 걸지 않는다.** 만들기와 달리 이미 시작한 일정·지난 일정을
          고치는 경우가 있고, 서버도 수정에는 "오늘 이후" 제약을 두지 않는다
          (`PlanUpdateRequest` — 그 제약은 AI 생성의 `AIPLAN_017` 뿐이다).
        */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Field
            id="plan-edit-start-date"
            label={messages.plan.fieldStartDate}
            required
            className="flex-1"
            {...(errors.fields.startDate === undefined ? {} : { error: errors.fields.startDate })}
          >
            <DateField
              id="plan-edit-start-date"
              label={messages.plan.fieldStartDate}
              placeholder={messages.plan.datePlaceholder}
              today={today}
              value={startDate}
              onValueChange={(next) => {
                setStartDate(next)
                // 어긋난 순간 종료일만 비워 다시 받는다 — 만들기 폼과 같은 처리다
                if (endDate !== '' && next > endDate) {
                  setEndDate('')
                  setEndDateOpen(true)
                }
              }}
              invalid={errors.fields.startDate !== undefined}
              rangeStart={startDate}
              rangeEnd={endDate}
            />
          </Field>

          <Field
            id="plan-edit-end-date"
            label={messages.plan.fieldEndDate}
            required
            className="flex-1"
            {...(errors.fields.endDate === undefined ? {} : { error: errors.fields.endDate })}
          >
            <DateField
              id="plan-edit-end-date"
              label={messages.plan.fieldEndDate}
              placeholder={messages.plan.datePlaceholder}
              today={today}
              value={endDate}
              onValueChange={setEndDate}
              open={endDateOpen}
              onOpenChange={setEndDateOpen}
              invalid={errors.fields.endDate !== undefined}
              // 시작일보다 이른 날짜는 달력에서 아예 고를 수 없다. 검증은 2차 방어다
              min={startDate === '' ? null : startDate}
              rangeStart={startDate}
              rangeEnd={endDate}
            />
          </Field>
        </div>

        {/*
          힌트를 **기간 줄 아래 한 번만** 둔다. 두 필드 각각에 붙이면 같은 말이 두 번 서고,
          이 문구가 말하는 것은 한쪽 날짜가 아니라 기간이라는 하나의 값이다.
        */}
        <p className="text-caption text-fg-muted -mt-2">{messages.plan.editPeriodHint}</p>

        {/*
          **기간 바로 아래 · 예산 위다** (D13-2). 만들기 폼이 `기간 → 반려견` 순서로 묻도록
          #400 이 맞춰 뒀고(`form-order.test.ts`), 수정 모달만 반려견을 예산 뒤로 보내면
          같은 서비스가 두 순서를 갖는다. 모달은 세로로 스크롤되므로 그룹이 길어져도
          예산이 잘리지 않는다.

          **상한(5)을 안내하지 않는다.** 회원당 반려견이 5마리 상한이라 전부 골라도 5다 —
          닿을 수 없는 한계를 말하면 없는 제약이 있는 것처럼 읽힌다.
        */}
        {petsEditable && (
          <div className="flex flex-col gap-2">
            <CheckboxGroup
              // `fieldErrorId('planEditPetIds')` 가 오류 id 다 — 오류는 fieldset 에 붙는다
              id="planEditPetIds"
              label={messages.plan.fieldPets}
              required
              options={pets.map((pet) => ({
                value: pet.petId,
                label: pet.name,
                description: describePet(pet),
              }))}
              values={petIds}
              onValuesChange={setPetIds}
              error={errors.fields.petIds}
            />
            {/*
              대표를 **사실로만** 말한다. 대표를 바꾸는 전용 컨트롤은 이번 범위가 아니다
              (D13-10 미결 1 — 라디오는 #174 가 걷어낸 기준 선택 컨트롤의 부활이다).
            */}
            <p className="text-caption text-fg-muted">{messages.plan.editPetsHint}</p>
          </div>
        )}

        <Field
          id="plan-edit-budget"
          label={messages.plan.fieldBudget}
          // 예산을 비우는 방법이 서버에 없다 — 0 으로 저장된다는 것을 미리 말한다 (D4)
          hint={messages.plan.editBudgetHint}
          {...(errors.fields.budget === undefined ? {} : { error: errors.fields.budget })}
        >
          <Input
            id="plan-edit-budget"
            value={budget}
            onValueChange={setBudget}
            invalid={errors.fields.budget !== undefined}
            inputMode="numeric"
          />
        </Field>

        <FormAlert message={errors.form} />
      </div>
    </Modal>
  )
}
