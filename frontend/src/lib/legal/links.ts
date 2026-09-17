import { messages } from '@/lib/messages'

/**
 * 약관·처리방침으로 가는 링크 — 이슈 #610.
 *
 * **푸터와 마이페이지가 같은 목록을 쓴다.** 두 곳에 따로 적으면 한쪽만 고쳐지고,
 * 라벨이 갈리면 같은 문서가 화면마다 다른 이름으로 보인다. 라벨은 문서 제목 그 자체라
 * `messages.legal` 에서 가져온다 — 여기서 다시 짓지 않는다.
 *
 * **문의는 아직 없다.** 페이지가 생기면 그때 더한다 — 없는 링크를 만들지 않는다는
 * 규칙은 그대로다 (`messages/footer.ts`).
 */
/**
 * 문서별 경로. **목록과 따로 노출한다** — 가입 동의 체크박스(#688)는 "이용약관" 하나만
 * 가리켜야 하는데, 목록에서 꺼내려면 인덱스나 라벨 비교로 골라야 한다. 둘 다 문서를
 * 하나 더 추가하는 순간 조용히 다른 곳을 가리킨다.
 */
export const LEGAL_HREF = {
  terms: '/terms',
  privacy: '/privacy',
} as const

export const LEGAL_LINKS = [
  { href: LEGAL_HREF.terms, label: messages.legal.termsTitle },
  { href: LEGAL_HREF.privacy, label: messages.legal.privacyTitle },
] as const
