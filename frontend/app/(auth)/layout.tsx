import type { Metadata } from 'next'

import { NOINDEX_FOLLOW } from '@/lib/seo/page-metadata'

/**
 * **이 그룹 화면은 색인하지 않는다** (#1130). 로그인·가입·비밀번호 찾기·소셜 콜백은 검색으로
 * 찾아올 화면이 아니고, 헤더가 `/login?returnTo=…` 처럼 쿼리만 다른 주소를 여럿 링크해
 * 크롤러에게는 같은 화면이 수십 개로 보인다. 그룹 레이아웃에 한 번 두면 화면 넷이 상속한다
 * — 화면이 `robots` 를 따로 내지 않는 한 덮이지 않는다.
 *
 * `robots.txt` 로 막지 않는 이유는 `lib/seo/robots.ts` 머리주석.
 */
export const metadata: Metadata = { robots: NOINDEX_FOLLOW }

/**
 * 인증 화면 셸.
 *
 * `loading.tsx` 를 두지 않는다. 클라이언트 폼이라 서버 대기가 없고,
 * 경계가 있으면 응답이 먼저 스트리밍돼 리다이렉트 상태를 바꿀 수 없다
 * — docs/architecture-guide.md §7.
 *
 * **768 미만은 흰 바탕 한 면, 768 이상은 회색 바닥(L0) 위 카드(L1)다** (#1283 C1).
 *
 * #532 · 그 뒤 개정은 모든 폭에서 회색 바닥 위에 카드를 띄웠다 — "흰 폼을 흰 바닥에 그냥
 * 두면 입력할 영역의 경계가 없다" 는 이유였고, **넓은 화면에서는 지금도 맞다**: 중앙 384px
 * 열이 빈 흰 면 한가운데 떠 있는 글줄 묶음으로 읽힌다. 그러나 375 에서는 카드가 화면을 거의
 * 다 차지해 경계가 하는 일이 없고, 카드 테두리와 좌우 여백이 겹쳐 **박스 안의 박스**로 보이며
 * 입력칸만 좁아졌다(내용 폭 326). 카카오 · 네이버 · 토스의 모바일 인증 화면은 모두 카드 없는
 * 흰 한 면이다. 그래서 카드를 **폭으로** 가른다 — `Surface`(L1)가 768 미만에서 radius 와 좌우
 * 테두리를 걷고 내려앉는 것과 같은 축이다.
 *
 * **세로는 위쪽 정렬이다** (#1283 C2). 가운데 정렬은 화면마다 내용 높이가 달라 로그인 →
 * 비밀번호 찾기로 넘길 때 첫 줄이 위아래로 튀었다. 데스크톱 카드만 가운데에 둔다 — 카드는
 * 한 덩어리로 움직여 튀어 보이지 않는다.
 *
 * **서비스 표식은 셸이 아니라 화면이 단다** (#532 → #1283). 들어오는 자리(로그인 · 소셜 콜백)는
 * `AuthBrand`, 하위 화면(가입 · 비밀번호 찾기)은 `AuthTopBar` 의 `←` 를 단다 — 두 컴포넌트의
 * 머리주석. 셸이 넷 모두에 락업을 그리면 하위 화면에서 락업과 `←` 가 같은 첫 줄을 다툰다.
 *
 * **`Canvas` 를 쓰지 않고 여기서 직접 칠한다.** `Canvas` 는 `page-canvas`
 * (`min-block-size: calc(100dvh - var(--header-h))`)를 함께 들고 오는데, 그 뺄셈은
 * `GlobalHeader` 가 있는 `(main)` 그룹의 전제다. **이 그룹에는 헤더가 없어서** 그대로
 * 쓰면 회색 바닥이 화면 끝에서 56px 못 미쳐 끊긴다. `token-usage.test.ts` 가
 * `bg-bg-sunken` 의 소유자를 검사하므로 그 허용 목록에 이 파일을 근거와 함께 올려 뒀다.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:bg-bg-sunken flex min-h-dvh w-full flex-col items-center md:justify-center md:px-4 md:py-10">
      {/*
        폭 제한(384)은 모든 폭에서 같다 — 모바일에서는 화면이 그보다 좁아 전폭이고, 넓은
        태블릿 세로(600~767)에서도 입력칸이 화면 끝까지 늘어지지 않는다.

        좌우 16 — 카드가 없는 모바일에서 이 값이 곧 페이지 인셋이라 제품의 왼쪽 기준선(모바일 16,
        DESIGN.md "왼쪽 인셋")을 따른다. 데스크톱 카드 안은 카드 규약 20. radius 12(`rounded-lg`) · 그림자 없음은 `Surface` 와 같은 L1 값이다 (§6, `surface.tsx`).

        `relative` 는 폼 화면의 캐릭터(`AuthCardDog`, #939)가 카드 옆에 서는 기준 상자다.
      */}
      <main className="md:bg-bg md:border-border relative w-full max-w-sm px-4 pb-10 md:rounded-lg md:border md:px-5 md:py-6">
        {children}
      </main>
    </div>
  )
}
