import { StateCharacter } from '@/components/character'

/**
 * 인증 카드 옆 캐릭터 (#939, DESIGN.md §0-5).
 *
 * **카드 오른쪽 바깥에 정면으로 앉고 발을 카드 아랫선에 댄다.** 소개 페이지 마무리와 같은
 * 자세 · 같은 규칙(카드 밖, 선에 발을 댄다)이다. 기준 상자는 `(auth)/layout.tsx` 의 `<main>`
 * (`relative`)이다 — 이 컴포넌트는 그 카드의 **직계 내용**으로만 선다.
 *
 * **폼 화면 넷(로그인 · 가입 · 소셜 가입 동의 · 비밀번호 찾기)에만 둔다 — 셸이 아니다.** 셸에
 * 두면 같은 그룹의 OAuth 콜백에도 선다. 그 화면은 폼이 아니라 교환 중(스켈레톤) · 일시 장애 ·
 * 실패를 그리는 상태 화면이라 §0-5 "들이지 않는 곳" 에 걸린다. 이미 로그인한 안내
 * (`LoggedInNotice`)에도 두지 않는다 — 폼 갈래에서만 부른다.
 *
 * **카드 윗변에 두지 않았다.** 처음에는 윗변 오른쪽 끝에 앉혔는데 1280 실측에서 개가 워드마크
 * 끝과 16px 떨어져 락업과 같은 높이에 섰다 — 로고가 "워드마크 + 개" 로 읽혔다. 옆 바닥은
 * 1024 이상에서 좌우 320px 넘게 비어 있어 락업과 멀리 떨어진다.
 *
 * **1024 이상만이다.** 그 아래에서는 카드가 화면 폭을 거의 다 써서 옆 자리가 없다.
 */
export function AuthCardDog() {
  return (
    <StateCharacter pose="sitFront" className="absolute start-full bottom-0 ms-6 hidden lg:block" />
  )
}
