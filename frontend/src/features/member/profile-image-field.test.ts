import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  exceedsProfileImageLimit,
  ProfileImageField,
  type ProfileImageFieldProps,
} from '@/features/member/profile-image-field'
import { MAX_PROFILE_IMAGE_BYTES, PROFILE_IMAGE_PART } from '@/lib/api/member'
import { messages } from '@/lib/messages'

function render(overrides: Partial<ProfileImageFieldProps> = {}) {
  return renderToStaticMarkup(
    createElement(ProfileImageField, {
      url: null,
      uploading: false,
      removing: false,
      error: null,
      status: null,
      onSelect: () => undefined,
      onRemove: () => undefined,
      ...overrides,
    }),
  )
}

/**
 * 화면이 먼저 막는 상한. **서버 검증을 대신하지 않는다** — 서버도 `STORAGE_002` 로 막고,
 * 형식은 매직 바이트라 서버만 판정할 수 있다. 여기서 막는 이유는 BFF 가 재시도를 위해
 * 본문을 통째로 메모리에 올리기 때문이다 (`forwarded-body.ts`).
 */
describe('exceedsProfileImageLimit — 서버 상한(5MB)의 복제본', () => {
  it('상한과 정확히 같으면 통과한다 — 경계값은 서버도 허용한다', () => {
    expect(exceedsProfileImageLimit(MAX_PROFILE_IMAGE_BYTES)).toBe(false)
  })

  it('1바이트만 넘어도 막는다', () => {
    expect(exceedsProfileImageLimit(MAX_PROFILE_IMAGE_BYTES + 1)).toBe(true)
  })

  it('상한이 서버 설정과 같은 5MB 다', () => {
    // spring.servlet.multipart.max-file-size: 5MB / infra.storage.max-file-bytes: 5242880
    expect(MAX_PROFILE_IMAGE_BYTES).toBe(5_242_880)
  })

  it('업로드 파트명이 컨트롤러의 @RequestPart 와 같다', () => {
    expect(PROFILE_IMAGE_PART).toBe('imageFile')
  })
})

describe('ProfileImageField', () => {
  /** 입력을 숨기고 버튼만 두면 키보드로 닿지 않는다 (D6) */
  it('파일 입력이 보이는 label 안에 있다 — sr-only 는 포커스를 살린다', () => {
    const markup = render()

    expect(markup).toMatch(/<label[^>]*>[\s\S]*<input[^>]*type="file"/)
    expect(markup).toContain('class="sr-only"')
  })

  it('accept 는 서버가 허용하는 4종이다 — 검증이 아니라 편의다', () => {
    const markup = render()

    expect(markup).toContain('image/jpeg')
    expect(markup).toContain('image/png')
    expect(markup).toContain('image/gif')
    expect(markup).toContain('image/webp')
  })

  it('사진이 없으면 삭제 버튼을 내지 않는다 — 지울 것이 없다', () => {
    expect(render({ url: null })).not.toContain(messages.member.profileImageRemove)
  })

  it('사진이 있으면 미리보기와 삭제 버튼을 낸다', () => {
    const url = 'http://localhost:9000/hondigagae-local/members/profiles/mock/a.png'
    const markup = render({ url })

    expect(markup).toContain(url)
    expect(markup).toContain(messages.member.profileImageRemove)
  })

  /** 아바타 이미지가 바뀌는 것은 스크린리더에 아무 변화가 아니다 */
  it('상태 변화를 aria-live 로 알린다', () => {
    const markup = render({ status: messages.member.profileImageUploaded })

    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain(messages.member.profileImageUploaded)
  })

  it('실패는 role="alert" 로 알린다', () => {
    const markup = render({ error: messages.member.profileImageTooLarge })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.member.profileImageTooLarge)
  })

  it('업로드 중에는 선택과 삭제를 잠근다', () => {
    const url = 'http://localhost:9000/hondigagae-local/a.png'
    const markup = render({ url, uploading: true })

    expect(markup).toContain(messages.member.profileImageUploading)
    // 파일 입력과 삭제 버튼 둘 다 disabled 여야 한다 — 하나만 잠그면 중복 요청이 나간다
    expect(markup.match(/disabled=""/g)?.length).toBe(2)
  })

  it('삭제 중에도 선택을 잠근다', () => {
    const url = 'http://localhost:9000/hondigagae-local/a.png'
    const markup = render({ url, removing: true })

    expect(markup.match(/disabled=""/g)?.length).toBe(2)
  })

  /** 상한을 화면이 말한다 — 서버 설정을 확인했으므로 (공통명세 S5-1 해소) */
  it('허용 형식과 크기 상한을 화면이 말한다', () => {
    expect(render()).toContain(messages.member.profileImageHint)
  })
})

describe('ProfileAvatar 폴백 — ProfileImageField 를 통해 확인한다', () => {
  /**
   * URL 이 안 열리면 `<img>` 는 깨진 이미지 아이콘을 그린다. 저장된 URL 은 살아 있는데
   * 호스트가 죽었거나 파일이 지워진 경우가 실제로 생긴다 — `onError` 로 사람 아이콘에
   * 떨어뜨린다. 마크업에 핸들러가 붙어 있는지까지가 이 환경에서 확인 가능한 범위다.
   */
  it('사진이 있으면 img 를, 없으면 아이콘을 그린다', () => {
    const withImage = render({ url: 'http://localhost:9000/hondigagae-local/a.png' })
    const withoutImage = render({ url: null })

    expect(withImage).toContain('<img')
    expect(withoutImage).not.toContain('<img')
    expect(withoutImage).toContain('<svg')
  })
})
