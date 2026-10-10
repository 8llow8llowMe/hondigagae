/**
 * 공유 비밀번호 정규식 — **백엔드 `@Pattern` 의 복제본이다.**
 *
 * 회원가입(`MemberGeneralSignupRequest`) · 비밀번호 변경(`MemberPasswordChangeRequest`) ·
 * 최초 설정(`MemberPasswordSetupRequest`)이 **문자 하나까지 같은 정규식**을 쓴다.
 * 공백 없이 영문자 · 숫자 · 특수문자를 각각 1자 이상.
 *
 * `src/lib/` 에 두는 이유는 `EMAIL_PATTERN` 과 같다: `src/features/auth/schemas.ts` ·
 * `src/features/member/schemas.ts`(zod) 와 `src/lib/api/mock/auth-data.ts`(mock 검증)가
 * **같은 규칙**을 써야 한다. 두 벌이 되면 한쪽만 고쳐졌을 때 같은 비밀번호가 화면에
 * 따라 통과·거부로 갈린다. `src/lib/` 은 `src/features/` 를 임포트할 수 없으므로
 * (architecture-guide.md §3) 공유 지점을 lib 쪽에 둔다.
 *
 * 길이(8~20)는 여기 넣지 않는다. 백엔드도 `@Size`(MEMBER_104)와 `@Pattern`(MEMBER_105)이
 * 별도 제약이고, 메시지가 갈려야 "짧다" 와 "구성이 모자라다" 를 따로 안내할 수 있다.
 */
export const PASSWORD_PATTERN =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|])\S+$/
