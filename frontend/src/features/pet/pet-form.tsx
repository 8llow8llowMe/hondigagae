'use client'

import { useEffect, useRef, useState } from 'react'

import type { ReactNode } from 'react'

import { Button } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { RadioGroup } from '@/components/radio-group'
import { petFormSchema } from '@/features/pet/schemas'
import { ApiError, classify, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { PET_LIMIT_EXCEEDED_CODE } from '@/lib/api/pet'
import type { FormErrors } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import { useUnsavedWarning } from '@/lib/form/use-unsaved-warning'
import { messages } from '@/lib/messages'
import { toPetSavePayload } from '@/lib/pet/form'
import type { Pet, PetFormValues } from '@/types/pet'

const labels = messages.pet.labels

/** 라디오 선택지 — 열거 API 가 없어 FE 가 들고 있다 (공통명세 S6-1) */
const sizeOptions = messages.pet.options.sizeType.map((option) => ({
  value: option.code,
  label: option.name,
  description: option.description,
}))
const activityOptions = messages.pet.options.activityLevel.map((option) => ({
  value: option.code,
  label: option.name,
  description: option.description,
}))
const socialityOptions = messages.pet.options.sociality.map((option) => ({
  value: option.code,
  label: option.name,
  description: option.description,
}))

export type PetFormFieldsProps = {
  values: PetFormValues
  errors: FormErrors
  /** 실패한 요청의 HTTP 상태. 성공했거나 아직 요청을 보내지 않았으면 null */
  errorStatus: number | null
  submitting: boolean
  submitLabel: string
  /** 등록·수정을 가르는 유일한 표시 차이. 수정에서는 삭제 영역이 들어온다 */
  footer?: ReactNode
  onValueChange: <K extends keyof PetFormValues>(key: K, value: PetFormValues[K]) => void
  onSubmit: () => void
  onRetry: () => void
}

/**
 * 표시 전용. 상태를 갖지 않아 node 환경에서 렌더 테스트가 된다
 * (`testing-guide.md` §1).
 *
 * 섹션 구성은 등록-세부명세 D1 을 따른다 — 기본 정보 / 크기 / 성향 / 민감도.
 */
export function PetFormFields({
  values,
  errors,
  errorStatus,
  submitting,
  submitLabel,
  footer,
  onValueChange,
  onSubmit,
  onRetry,
}: PetFormFieldsProps) {
  // 5xx·무응답만 ErrorState 다. **폼을 대체하지 않고 위에 얹는다** — 대체하면
  // 입력값을 고칠 수단이 사라져 새로고침밖에 남지 않는다
  // (등록-세부명세 D5, 이슈 #24 최종 리뷰 I1).
  const isTemporaryError = errorStatus !== null && classify(errorStatus) === 'temporary'

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {isTemporaryError && (
        <ErrorState
          title={messages.common.temporaryErrorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
        />
      )}
      <FormAlert message={errors.form} />

      <section className="flex flex-col gap-4">
        <h2 className="text-title-3 text-fg font-semibold">기본 정보</h2>

        <Field id="name" label={labels.name} error={errors.fields.name} required>
          <Input
            id="name"
            value={values.name}
            onValueChange={(value) => onValueChange('name', value)}
            invalid={errors.fields.name !== undefined}
          />
        </Field>

        <Field
          id="breed"
          label={labels.breed}
          error={errors.fields.breed}
          hint={messages.pet.hints.optional}
        >
          <Input
            id="breed"
            value={values.breed}
            onValueChange={(value) => onValueChange('breed', value)}
            invalid={errors.fields.breed !== undefined}
          />
        </Field>

        <Field
          id="birthYm"
          label={labels.birthYm}
          error={errors.fields.birthYm}
          hint={messages.pet.hints.birthYm}
        >
          <Input
            id="birthYm"
            inputMode="numeric"
            placeholder="2017-05"
            value={values.birthYm}
            onValueChange={(value) => onValueChange('birthYm', value)}
            invalid={errors.fields.birthYm !== undefined}
          />
        </Field>
      </section>

      <section>
        <RadioGroup
          id="sizeType"
          label={labels.sizeType}
          options={sizeOptions}
          value={values.sizeType}
          onValueChange={(value) => onValueChange('sizeType', value)}
          error={errors.fields.sizeType}
          required
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-title-3 text-fg font-semibold">성향</h2>

        <RadioGroup
          id="activityLevel"
          label={labels.activityLevel}
          options={activityOptions}
          value={values.activityLevel}
          onValueChange={(value) => onValueChange('activityLevel', value)}
          error={errors.fields.activityLevel}
          required
        />

        <RadioGroup
          id="sociality"
          label={labels.sociality}
          options={socialityOptions}
          value={values.sociality}
          onValueChange={(value) => onValueChange('sociality', value)}
          error={errors.fields.sociality}
          required
        />

        <Checkbox
          id="walkPreferred"
          label={labels.walkPreferred}
          checked={values.walkPreferred}
          onCheckedChange={(checked) => onValueChange('walkPreferred', checked)}
        />
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-title-3 text-fg font-semibold">민감도</h2>

        <Checkbox
          id="heatSensitive"
          label={labels.heatSensitive}
          checked={values.heatSensitive}
          onCheckedChange={(checked) => onValueChange('heatSensitive', checked)}
        />
        <Checkbox
          id="coldSensitive"
          label={labels.coldSensitive}
          checked={values.coldSensitive}
          onCheckedChange={(checked) => onValueChange('coldSensitive', checked)}
        />
        <Checkbox
          id="noiseSensitive"
          label={labels.noiseSensitive}
          checked={values.noiseSensitive}
          onCheckedChange={(checked) => onValueChange('noiseSensitive', checked)}
        />
      </section>

      <Button type="submit" size="lg" loading={submitting}>
        {submitLabel}
      </Button>

      {footer}
    </form>
  )
}

export type PetFormProps = {
  initialValues: PetFormValues
  submitLabel: string
  footer?: ReactNode
  /** 등록은 createPet, 수정은 updatePet 을 넘긴다 */
  onSave: (payload: ReturnType<typeof toPetSavePayload>) => Promise<Pet>
  onSaved: (pet: Pet) => void
}

/**
 * 등록·수정 공용 폼.
 *
 * 백엔드가 `PetSaveRequest` 를 등록·수정에 공유하므로 폼도 하나여야 계약과
 * 어긋나지 않는다 (공통명세 S2). 차이는 props 로 받는다.
 */
export function PetForm({ initialValues, submitLabel, footer, onSave, onSaved }: PetFormProps) {
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { values, errors, isSubmitting, isDirty, setValue, submit, firstErrorField, submitCount } =
    useForm<PetFormValues, Pet>({
      schema: petFormSchema,
      initialValues,
      onSubmit: async (submitted) => {
        try {
          // 빈 값을 null 로, enum 을 code 로 — 이 변환을 건너뛰면
          // birthYm: '' 가 400(PET_104)이 된다 (공통명세 S3-3)
          const result = await onSave(toPetSavePayload(submitted))
          setErrorStatus(null)
          return result
        } catch (error) {
          setErrorStatus(toStatus(error))
          throw error
        }
      },
      onSuccess: (pet) => onSaved(pet),
    })

  useUnsavedWarning(isDirty && !isSubmitting)

  // submitCount 만 의존한다. errors 를 넣으면 두 필드가 동시 오류일 때 한 필드를
  // 타이핑하다 포커스를 빼앗긴다 — 이슈 #24 발견 7.
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    containerRef.current?.querySelector<HTMLElement>(`#${firstErrorField}`)?.focus()
  }, [submitCount])

  return (
    <div ref={containerRef}>
      <PetFormFields
        values={values}
        errors={errors}
        errorStatus={errorStatus}
        submitting={isSubmitting}
        submitLabel={submitLabel}
        footer={footer}
        onValueChange={(key, value) => {
          // 5xx 를 받은 뒤 값을 고치면 ErrorState 를 걷는다 — 등록-세부명세 D4
          setErrorStatus(null)
          setValue(key, value)
        }}
        onSubmit={() => void submit()}
        onRetry={() => void submit()}
      />
    </div>
  )
}

/** ApiError 가 아니면 전송 단계 실패(무응답)로 본다 — src/lib/api/error.ts 관례 */
function toStatus(error: unknown): number {
  return error instanceof ApiError ? error.status : NO_RESPONSE_STATUS
}

/**
 * `PET_002`(등록 상한) 는 필드 검증 400 과 같은 상태코드다. resultCode 로만
 * 구분된다 — 공통명세 S4-2. 등록 화면이 이 판정을 쓴다.
 */
export function isPetLimitExceeded(error: unknown): boolean {
  return error instanceof ApiError && error.resultCode === PET_LIMIT_EXCEEDED_CODE
}
