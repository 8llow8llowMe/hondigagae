import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 변경 폼과 최초 설정 폼은 **현재 비밀번호 필드 하나만 다르다.** 두 벌로 만들면
 * 새 비밀번호의 라벨·검증·자동완성 힌트가 두 곳에 복제되고, 한쪽만 고쳐진다.
 */
export type PasswordFormMode = 'change' | 'setup'

export type PasswordFormFieldsProps = {
  mode: PasswordFormMode
  currentPassword: string
  newPassword: string
  errors: FormErrors
  submitting: boolean
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onSubmit: () => void
}

/**
 * 표시 전용. 상태를 갖지 않아 node 환경에서 렌더 테스트가 된다
 * — docs/testing-guide.md §1.
 *
 * `autoComplete` 를 정확히 준다. 비밀번호 관리자가 **현재 비밀번호와 새 비밀번호를
 * 구분하지 못하면** 저장된 값을 새 비밀번호 칸에 채워 넣는다.
 *
 * 표시 토글을 두지 않는다. 로그인과 달리 이 화면은 **두 개의 비밀번호 칸**이 있어
 * 토글이 둘이 되고, 어느 쪽이 보이는 상태인지가 화면에서 읽히지 않는다.
 */
export function PasswordFormFields({
  mode,
  currentPassword,
  newPassword,
  errors,
  submitting,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSubmit,
}: PasswordFormFieldsProps) {
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {mode === 'setup' && (
        <p className="text-body-2 text-fg-muted">{messages.member.passwordSetupDescription}</p>
      )}

      <FormAlert message={errors.form} />

      {mode === 'change' && (
        <Field
          id="currentPassword"
          label={messages.member.currentPasswordLabel}
          error={errors.fields.currentPassword}
          required
        >
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onValueChange={onCurrentPasswordChange}
            invalid={errors.fields.currentPassword !== undefined}
          />
        </Field>
      )}

      <Field
        id="newPassword"
        label={messages.member.newPasswordLabel}
        error={errors.fields.newPassword}
        hint={messages.form.passwordPattern}
        required
      >
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onValueChange={onNewPasswordChange}
          invalid={errors.fields.newPassword !== undefined}
        />
      </Field>

      <Button type="submit" size="lg" loading={submitting} className="mt-2">
        {mode === 'change'
          ? messages.member.passwordChangeSubmit
          : messages.member.passwordSetupSubmit}
      </Button>
    </form>
  )
}
