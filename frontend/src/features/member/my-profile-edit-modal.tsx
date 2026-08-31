'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { Modal } from '@/components/modal'
import { exceedsProfileImageLimit, ProfileImageField } from '@/features/member/profile-image-field'
import { nicknameSchema, type NicknameValues } from '@/features/member/schemas'
import {
  useRemoveProfileImage,
  useUpdateMyInfo,
  useUploadProfileImage,
} from '@/features/member/use-my-info'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'
import type { MemberMyInfo } from '@/types/member'

/**
 * 내 정보 수정 — 닉네임 + 프로필 사진 (D2 · D4).
 *
 * **두 가지가 한 자리에 있지만 저장 시점이 다르다.**
 *  - 닉네임: `저장` 을 눌러야 `PATCH /members/me` 가 나간다
 *  - 사진: **고르는 즉시** 업로드된다 (별도 API 고 응답 모양도 다르다)
 *
 * 한 버튼에 묶으면 "닉네임은 저장됐는데 사진은 실패" 를 한 버튼으로 설명해야 한다.
 * 대신 사진 쪽 실패는 사진 영역 안에서만 말한다 — 폼 전체 오류로 올리면 닉네임을
 * 못 저장한 것처럼 읽힌다.
 *
 * `Modal`(#79)을 쓴다. **입력 폼이라 `role="dialog"` 이고 `size="md"` 다** —
 * `alertdialog` 는 되돌릴 수 없는 확인 전용이다.
 */
export function MyProfileEditModal({
  open,
  onClose,
  member,
}: {
  open: boolean
  onClose: () => void
  member: MemberMyInfo
}) {
  const update = useUpdateMyInfo()
  const upload = useUploadProfileImage()
  const remove = useRemoveProfileImage()

  const nicknameRef = useRef<HTMLInputElement>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageStatus, setImageStatus] = useState<string | null>(null)

  const { values, errors, isSubmitting, setValue, submit, reset, firstErrorField, submitCount } =
    useForm<NicknameValues, void>({
      schema: nicknameSchema,
      initialValues: { nickname: member.nickname },
      onSubmit: async (submitted) => {
        await update.mutateAsync({ nickname: submitted.nickname })
      },
      onSuccess: onClose,
    })

  /*
    열릴 때마다 서버의 현재 닉네임으로 되돌린다. 닫고 다시 열면 지난번에 고치다 만 값이
    남아 있는데, 그것은 저장되지 않은 값이라 "현재 내 정보" 를 잘못 보여주는 것이다.
    사진 쪽 안내도 함께 비운다 — 지난번 실패 문구가 새로 연 모달에 남으면 안 된다.
  */
  useEffect(() => {
    if (!open) return
    reset({ nickname: member.nickname })
    setImageError(null)
    setImageStatus(null)
  }, [open, member.nickname, reset])

  // submitCount 만 의존한다 — 입력 중 포커스를 훔치지 않기 위해서다 (use-form.ts 주석)
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    nicknameRef.current?.focus()
  }, [submitCount])

  async function handleSelect(file: File) {
    setImageError(null)
    setImageStatus(null)

    /*
      화면이 먼저 막는다. 서버도 `STORAGE_002` 로 막지만, BFF 가 재시도를 위해 본문을
      통째로 메모리에 올리므로(`forwarded-body.ts`) 거기까지 보내지 않는 편이 낫다.
      **서버 검증을 대신하는 것이 아니다** — 매직 바이트 판정은 서버만 할 수 있다.
    */
    if (exceedsProfileImageLimit(file.size)) {
      setImageError(messages.member.profileImageTooLarge)
      return
    }

    try {
      await upload.mutateAsync(file)
      setImageStatus(messages.member.profileImageUploaded)
    } catch (caught) {
      // 형식·크기 오류는 서버 문구가 더 정확하다 (STORAGE_003 등) — 그대로 낸다
      setImageError(
        apiErrorToFormErrors(caught, messages.member.profileImageUploadFailed).form ??
          messages.member.profileImageUploadFailed,
      )
    }
  }

  async function handleRemove() {
    setImageError(null)
    setImageStatus(null)
    try {
      await remove.mutateAsync()
      setImageStatus(messages.member.profileImageRemoved)
    } catch (caught) {
      setImageError(
        apiErrorToFormErrors(caught, messages.member.profileImageUploadFailed).form ??
          messages.member.profileImageUploadFailed,
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.member.editProfileTitle}
      size="md"
      initialFocusRef={nicknameRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {messages.member.cancel}
          </Button>
          <Button loading={isSubmitting} onClick={() => void submit()}>
            {messages.member.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ProfileImageField
          url={member.profileImageUrl}
          uploading={upload.isPending}
          removing={remove.isPending}
          error={imageError}
          status={imageStatus}
          onSelect={(file) => void handleSelect(file)}
          onRemove={() => void handleRemove()}
        />

        <FormAlert message={errors.form} />

        {/*
          `<form>` 을 두지 않는다. `Modal` 의 footer 는 패널 바깥이라 submit 버튼이 이 폼에
          속하지 않고, 그러면 Enter 제출과 버튼 클릭이 서로 다른 경로가 된다.
          Enter 제출은 입력의 onKeyDown 이 맡는다.
        */}
        <Field id="nickname" label={messages.member.nicknameLabel} error={errors.fields.nickname}>
          <Input
            ref={nicknameRef}
            id="nickname"
            maxLength={10}
            autoComplete="nickname"
            value={values.nickname}
            onValueChange={(value) => setValue('nickname', value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              void submit()
            }}
            invalid={errors.fields.nickname !== undefined}
          />
        </Field>
      </div>
    </Modal>
  )
}
