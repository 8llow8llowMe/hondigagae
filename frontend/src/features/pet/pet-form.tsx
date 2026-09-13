'use client'

import { useEffect, useRef, useState } from 'react'

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
import { BIRTH_YM_LENGTH, formatBirthYmInput } from '@/lib/pet/birth-ym'
import { toPetSavePayload } from '@/lib/pet/form'
import { sizeChangeForWeight } from '@/lib/pet/size'
import { INSET_BLEED_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { Pet, PetFormValues } from '@/types/pet'

const labels = messages.pet.labels

/*
  **섹션 경계는 L2 채널이다** — `DESIGN.md §0` 은 카드(L1)에 면 + 테두리 + radius 를 주고
  **카드 안 아이템(L2)에는 채움이나 1px 구분선**을 준다. 아홉 필드가 구분 없이 한 줄로
  쌓여 읽히던 것(#538)은 여기서 닫는다.

  **섹션마다 카드를 주지 않는다.** §0 이 "전부 카드면 전부 같은 무게가 되어 위계가 다시
  사라진다" 고 못박았고, 이 폼은 제출 버튼 하나가 덮는 **한 이야기**라 카드 경계("이야기
  단위")의 대상이 아니다. #464 가 "폼이 카드 하나다" 로 이미 판정했고, 쪼개면 수정 화면의
  `lead`(주인공 카드)가 넷 중 어느 것인지도 사라진다.

  첫 섹션에는 붙이지 않는다 — 카드 제목 바로 아래 선이 한 겹 더 생긴다.
*/
const SECTION_DIVIDER = 'border-border border-t pt-6'

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
  onValueChange,
  onSubmit,
  onRetry,
}: PetFormFieldsProps) {
  // 5xx·무응답만 ErrorState 다. **폼을 대체하지 않고 위에 얹는다** — 대체하면
  // 입력값을 고칠 수단이 사라져 새로고침밖에 남지 않는다
  // (등록-세부명세 D5, 이슈 #24 최종 리뷰 I1).
  const isTemporaryError = errorStatus !== null && classify(errorStatus) === 'temporary'

  /*
    **제출 실패를 필드 밖에서도 말한다** (#538). 아홉 필드가 375 에서 네 화면이라, 틀린
    필드가 접힘 아래면 빨간 글자가 화면에 없어 **무엇이 잘못됐는지 알 수 없었다.**

    **토스트로 내지 않는다.** `styling-guide.md` §3-2 가 "오류를 토스트로 말하지 않는다 —
    오류는 섹션 안에 남아야 다시 시도할 수 있다" 를 규칙으로 박아 뒀고, 여기가 정확히 그
    이유가 성립하는 자리다: 요약이 사라지면 스크롤해 내려간 뒤 남은 개수를 다시 볼 길이
    없다. `FormAlert` 는 `role="alert"` 라 스크린리더에도 닿는다 (form-guide.md §8).

    **개수를 세는 것으로 충분한 이유** — 어느 필드인지는 포커스가 이미 옮겨 가서 말하고
    (아래 `submitCount` effect), 필드마다의 문구는 그 자리에 남아 있다. 여기서 필드명을
    또 나열하면 같은 말이 세 번이 된다.

    **필드 오류가 곧 "제출이 실패했다" 다.** `errors.fields` 는 `submit()` 에서만 채워지고
    (`use-form.ts`) 사용자가 그 필드를 고치면 지워진다 — 별도의 "제출했는가" 플래그를
    내려받지 않아도 같은 것을 판정한다. 그래서 이 컴포넌트는 표시 전용으로 남는다.

    서버가 준 폼 전체 오류가 있으면 그쪽이 이긴다 — 요약("N개")보다 구체적이다.
  */
  const invalidCount = Object.keys(errors.fields).length
  const alertMessage =
    errors.form ??
    (invalidCount > 0
      ? messages.pet.submitInvalidSummary.replace('{count}', String(invalidCount))
      : null)

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
        /*
          카드는 이 파일이 아니라 호출부가 그린다 — 등록(`pet-create-view`)·수정
          (`pet-edit-view`) **둘 다** `<Surface lead title=...>` 안이라 제목을 한 단
          내린다 (#456①). 갈리는 호출부가 없어 prop 으로 뚫지 않았다.
        */
        <ErrorState
          headingLevel={3}
          inset="card"
          title={messages.common.temporaryErrorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
        />
      )}
      <FormAlert message={alertMessage} />

      <section className="flex flex-col gap-4">
        <h3 className="text-title-2 text-fg font-semibold">기본 정보</h3>

        <Field id="name" label={labels.name} error={errors.fields.name} required>
          <Input
            id="name"
            value={values.name}
            onValueChange={(value) => onValueChange('name', value)}
            invalid={errors.fields.name !== undefined}
          />
        </Field>

        {/* hint 를 달지 않는다 — 필수 표시(`*`)가 없는 것으로 선택 입력임이 이미 전달된다 */}
        <Field id="breed" label={labels.breed} error={errors.fields.breed}>
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
          {/* 하이픈을 사람이 치게 하지 않는다. 규칙은 `lib/pet/birth-ym.ts` 가 소유한다 */}
          <Input
            id="birthYm"
            inputMode="numeric"
            placeholder="2017-05"
            maxLength={BIRTH_YM_LENGTH}
            value={values.birthYm}
            onValueChange={(value) => onValueChange('birthYm', formatBirthYmInput(value))}
            invalid={errors.fields.birthYm !== undefined}
          />
        </Field>
      </section>

      {/*
        제목 없는 섹션이지만 **간격은 형제 섹션과 같아야 한다.** `gap` 이 없어 체중의
        hint 와 아래 `크기` 라디오 라벨이 붙어, 그 hint 가 체중이 아니라 크기의 안내처럼
        읽혔다. 제목(`h2`)은 두지 않는다 — 라디오 그룹이 이미 `크기` 라벨을 갖고 있어
        같은 말이 두 번 나온다.
      */}
      <section className={cn('flex flex-col gap-4', SECTION_DIVIDER)}>
        <Field
          id="weightKg"
          label={labels.weightKg}
          error={errors.fields.weightKg}
          hint={messages.pet.hints.weightKg}
        >
          {/* `type="number"` 를 쓰지 않는다 — 휠·화살표로 값이 바뀌고 로케일에 따라
              소수점이 콤마가 된다. 소수 한 자리 규칙은 스키마가 본다 */}
          {/*
            **단위를 입력란 안에 세운다** (#369). `placeholder="3.5kg"` 로 알리던 자리는
            **값을 채우는 순간 사라져** 무슨 단위인지 다시 알 수 없었다. `suffix` 는 값에
            들어가지 않는다 — 보내는 것은 숫자뿐이다.

            placeholder 에서도 `kg` 를 걷었다. 단위가 옆에 상시로 서므로 예시까지 단위를
            달면 `3.5kg kg` 로 겹쳐 읽힌다.
          */}
          <Input
            id="weightKg"
            inputMode="decimal"
            placeholder="3.5"
            suffix={messages.pet.weightUnit}
            value={values.weightKg}
            onValueChange={(value) => onValueChange('weightKg', value)}
            invalid={errors.fields.weightKg !== undefined}
          />
        </Field>

        <RadioGroup
          id="sizeType"
          label={labels.sizeType}
          options={sizeOptions}
          value={values.sizeType}
          onValueChange={(value) => onValueChange('sizeType', value)}
          error={errors.fields.sizeType}
          columns={3}
          required
        />
      </section>

      <section className={cn('flex flex-col gap-4', SECTION_DIVIDER)}>
        <h3 className="text-title-2 text-fg font-semibold">성향</h3>

        <RadioGroup
          id="activityLevel"
          label={labels.activityLevel}
          options={activityOptions}
          value={values.activityLevel}
          onValueChange={(value) => onValueChange('activityLevel', value)}
          error={errors.fields.activityLevel}
          columns={3}
          required
        />

        <RadioGroup
          id="sociality"
          label={labels.sociality}
          options={socialityOptions}
          value={values.sociality}
          onValueChange={(value) => onValueChange('sociality', value)}
          error={errors.fields.sociality}
          columns={3}
          required
        />

        <Checkbox
          id="walkPreferred"
          label={labels.walkPreferred}
          checked={values.walkPreferred}
          onCheckedChange={(checked) => onValueChange('walkPreferred', checked)}
        />
      </section>

      <section className={cn('flex flex-col gap-1', SECTION_DIVIDER)}>
        <h3 className="text-title-2 text-fg font-semibold">민감도</h3>

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

      {/*
        **제출을 뷰포트 바닥에 붙인다** (#538). 아홉 필드가 375 에서 네 화면이라 버튼이
        맨 끝에만 있으면 저장하려고 매번 끝까지 굴려야 했다.

        **`fixed` 가 아니라 `sticky` 다** — 장소 상세 하단 바(`place-detail-section.tsx`)가
        같은 판단을 실측으로 굳혔다. `sticky` 는 **자리를 스스로 차지해서** 본문 끝에 바
        높이만큼 여백을 따로 두지 않아도 마지막 줄이 가려지지 않는다.

        **오프셋이 폭마다 갈리는 이유도 거기서 왔다.** 비켜야 할 모바일 탭바가
        `md:hidden`(`mobile-tab-bar.tsx` 의 `h-16`)이라 768 부터는 사라진다. `bottom-16` 만
        두면 그 폭에서 바가 바닥에서 64px 떠 아래로 본문이 비친다.

        **배경을 갖는 것은 이 요소가 본문 위를 지나가기 때문이다.** §0 의 "카드 안 자식은
        자기 배경을 갖지 않는다" 는 *다른 면을 만들지 말라*는 뜻이고, 여기 `bg-bg` 는
        카드 자신의 면과 같은 값이라 새 면을 만들지 않는다. 각진 면이 radius 12 모서리를
        덮지도 않는다 — 카드 래퍼의 `pb-5` 가 바 아래에 남아 있다.

        `INSET_BLEED_CLASS.card` 로 카드 좌우 끝까지 편 뒤 같은 값을 padding 으로 되돌린다.
        구분선이 내용 폭에서 끊기면 띠가 아니라 그냥 밑줄로 읽힌다.
      */}
      <div
        className={cn(
          'bg-bg border-border sticky bottom-16 z-30 border-t pt-3 pb-3 md:bottom-0',
          INSET_BLEED_CLASS.card,
        )}
      >
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export type PetFormProps = {
  initialValues: PetFormValues
  submitLabel: string
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
export function PetForm({ initialValues, submitLabel, onSave, onSaved }: PetFormProps) {
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
        onValueChange={(key, value) => {
          // 5xx 를 받은 뒤 값을 고치면 ErrorState 를 걷는다 — 등록-세부명세 D4
          setErrorStatus(null)
          setValue(key, value)

          /*
            **체중을 적으면 크기를 맞춘다** (#369). 백엔드가 모순 조합을 `PET_004` 로
            거부하므로(#364), 어긋난 조합은 애초에 만들어질 수 없는 값이다 — 사용자가
            그 400 을 만나기 전에 여기서 닫는다.

            **체중이 크기를 이긴다.** 둘 중 체중이 더 구체적인 사실이고 크기는 그것에서
            파생되는 구분이다. 반대로 두면(크기가 이기면) 어느 쪽이 참인지 알 수 없다.
            사용자가 크기를 직접 어긋나게 고르는 갈래는 덮지 않고 스키마가 오류로 말한다 —
            방금 만진 필드를 화면이 되돌리면 폼과 씨름하는 느낌이 된다.

            **읽을 수 없는 값은 `null` 이라 라디오가 타이핑 도중에 튀지 않는다**
            (`1.` · `` · `abc`). 판정은 `lib/pet/size.ts` 한 곳이 갖는다.
          */
          if (key !== 'weightKg') return

          const derived = sizeChangeForWeight(value as string, values.sizeType)
          if (derived !== null) setValue('sizeType', derived)
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
