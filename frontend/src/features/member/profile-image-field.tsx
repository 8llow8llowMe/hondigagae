import { ProfileAvatar } from '@/features/member/profile-avatar'
import { MAX_PROFILE_IMAGE_BYTES, PROFILE_IMAGE_ACCEPT } from '@/lib/api/member'
import { messages } from '@/lib/messages'

/** 상한을 넘었는지. 순수 함수라 테스트가 파일 없이 판정만 확인할 수 있다 */
export function exceedsProfileImageLimit(sizeBytes: number): boolean {
  return sizeBytes > MAX_PROFILE_IMAGE_BYTES
}

export type ProfileImageFieldProps = {
  /** 지금 보여줄 이미지. 없으면 이니셜 자리(아이콘) */
  url: string | null
  uploading: boolean
  removing: boolean
  /** 업로드·삭제 실패 문구. 서버 `resultMessage` 를 그대로 받는다 */
  error: string | null
  /** 성공 직후 스크린리더에 읽을 문구 */
  status: string | null
  onSelect: (file: File) => void
  onRemove: () => void
}

/**
 * 프로필 사진 선택 · 미리보기 · 삭제.
 *
 * **선택 즉시 업로드한다** — 모달의 `저장` 과 분리한다 (D4). 업로드가 별도 API 고 응답
 * 모양도 다르다. 한 버튼에 묶으면 "닉네임은 저장됐는데 사진은 실패" 를 한 버튼으로
 * 설명해야 한다.
 *
 * **`<input type="file">` 을 보이는 `<label>` 과 연결한다.** 입력을 숨기고 버튼만 두면
 * 키보드로 닿지 않는다 (D6). `sr-only` 는 시각적으로만 감추고 포커스는 살려 둔다.
 *
 * 진행·성공·실패를 `aria-live="polite"` 로 알린다 — 아바타 이미지가 바뀌는 것은
 * 스크린리더에 아무 변화가 아니다.
 */
export function ProfileImageField({
  url,
  uploading,
  removing,
  error,
  status,
  onSelect,
  onRemove,
}: ProfileImageFieldProps) {
  const busy = uploading || removing

  return (
    <div className="flex items-center gap-4">
      <ProfileAvatar url={url} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/*
            label 이 곧 버튼이다. `Button` 으로 감싸고 input 을 숨기는 방식은 쓰지 않는다 —
            `<button>` 안의 label 클릭은 파일 선택기를 열지 못한다.
          */}
          <label
            className={
              busy
                ? 'text-body-2 border-border-strong text-fg-muted inline-flex h-11 cursor-not-allowed items-center rounded-md border px-4 font-semibold opacity-50'
                : 'text-body-2 border-border-strong text-fg hover:bg-band focus-within:ring-brand-500 inline-flex h-11 cursor-pointer items-center rounded-md border px-4 font-semibold focus-within:ring-2'
            }
          >
            {uploading ? messages.member.profileImageUploading : messages.member.profileImageSelect}
            <input
              type="file"
              className="sr-only"
              accept={PROFILE_IMAGE_ACCEPT}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                // 같은 파일을 다시 골라도 change 가 나게 값을 비운다.
                // 업로드 실패 후 재시도가 조용히 막히는 것을 막는다
                event.target.value = ''
                if (file !== undefined) onSelect(file)
              }}
            />
          </label>

          {url !== null && url.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="text-body-2 text-fg-muted focus-visible:ring-brand-500 inline-flex h-11 items-center px-2 font-medium focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              {messages.member.profileImageRemove}
            </button>
          )}
        </div>

        <p className="text-caption text-fg-muted">{messages.member.profileImageHint}</p>

        {/* 이미지 교체는 스크린리더에 보이지 않는 변화라 문구로 알린다 */}
        <p aria-live="polite" className="text-caption text-fg-muted">
          {status}
        </p>

        {error !== null && (
          <p role="alert" className="text-caption text-danger-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
