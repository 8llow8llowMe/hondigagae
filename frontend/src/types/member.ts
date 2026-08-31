import type { CodeNameMetadata } from '@/types/api'

/**
 * 내 회원 정보.
 *
 * 근거: backend `MemberMyInfoResponse` (auth-service member 컨텍스트).
 * 확인 방법: http://localhost:8081/v3/api-docs — 백엔드 미기동 상태에서는 소스 실측 기준이다.
 * 계약 상세는 docs/features/member/공통명세.md S1.
 *
 * 주의
 *  - `memberId` 는 문자열이다. 백엔드 내부는 long(Snowflake)이고 응답 DTO 가 String 으로
 *    내려준다. number 로 타이핑하면 정밀도가 손상된다.
 *  - `provider` 는 metadata 객체가 **아니다.** `"KAKAO"` 원문 문자열이라 표시명을
 *    서버에서 받을 수 없다 — 매핑은 `src/lib/member/provider.ts` 한 곳에서만 한다.
 *  - `provider` × `hasPassword` 조합이 계정 상태를 정한다 (`src/lib/member/account-state.ts`).
 *  - **`profileImageUrl` 은 이 타입으로 바꾸지 않는다.** 수정 요청 DTO 에 필드가 없다 —
 *    업로드/삭제 전용 API 로만 바뀐다 (공통명세 S1).
 */
export type MemberMyInfo = {
  memberId: string
  email: string
  name: string
  nickname: string
  profileImageUrl: string | null
  role: CodeNameMetadata
  /** 일반 계정이면 null. `'KAKAO'` 등 원문 문자열 */
  provider: string | null
  hasPassword: boolean
}

/**
 * 내 정보 수정 요청 본문.
 *
 * **바꿀 수 있는 것은 `nickname` 하나뿐이다** — `MemberMyInfoUpdateRequest` 에 다른
 * 필드가 없다. 프로필 이미지 URL 을 여기에 실을 수 없는 이유는 DTO 주석이 적어 뒀다:
 * 임의 URL 을 회원 정보에 넣을 수 있으면 외부 이미지를 우리 서비스인 것처럼 노출시킬 수 있다.
 */
export type MemberUpdatePayload = {
  nickname: string
}

/**
 * 프로필 이미지 업로드 응답.
 *
 * **삭제 응답과 모양이 다르다.** 업로드는 이 두 필드뿐이고, 삭제는
 * `MemberMyInfoResponse` 전체다 (공통명세 S1). 그래서 캐시 갱신 방법도 갈린다 —
 * 업로드는 `profileImageUrl` 만 갈아끼우고, 삭제는 응답으로 통째로 바꾼다.
 */
export type ProfileImageUploadResult = {
  profileImageKey: string
  profileImageUrl: string
}

/** 비밀번호 변경 요청 본문 — `MemberPasswordChangeRequest` */
export type PasswordChangePayload = {
  currentPassword: string
  newPassword: string
}

/** 비밀번호 최초 설정 요청 본문 — `MemberPasswordSetupRequest` */
export type PasswordSetupPayload = {
  newPassword: string
}
