/**
 * 약관·처리방침 **화면** 문구 — 이슈 #610.
 *
 * **본문은 여기 없다.** 본문은 `src/lib/legal/*` 에 있고 합니다체다 (법률문서의 어미).
 * 이 파일의 문구는 화면이 만드는 것이라 다른 화면과 같은 해요체를 쓴다 — 같은 페이지에서
 * 어미가 갈리는 것처럼 보이지만, 갈리는 단위가 **문서 본문 / 서비스가 붙이는 라벨** 로
 * 뚜렷해서 읽는 사람에게는 오히려 자연스럽다.
 *
 * **경계가 테스트로 강제된다.** `message-tone.test.ts` 는 이 디렉터리만 훑으므로,
 * 본문을 여기로 흘려 넣으면 합쇼체가 걸려 실패한다.
 */
export const legalMessages = {
  termsTitle: '이용약관',
  termsDescription: '혼디가개 서비스를 이용할 때 적용되는 약관이에요.',
  privacyTitle: '개인정보 처리방침',
  privacyDescription: '혼디가개가 어떤 정보를 받고 어떻게 다루는지 알려드려요.',
  tocLabel: '목차',
  effectiveDateLabel: '시행일',
  historyLabel: '개정 이력',
  /** `제3조` — 목차와 조문 제목이 같은 말을 쓰게 한 곳에서 만든다 */
  articleLabel: (no: number) => `제${no}조`,
} as const
