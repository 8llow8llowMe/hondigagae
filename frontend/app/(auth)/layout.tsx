import Link from 'next/link'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'

/**
 * 인증 화면 셸.
 *
 * `loading.tsx` 를 두지 않는다. 클라이언트 폼이라 서버 대기가 없고,
 * 경계가 있으면 응답이 먼저 스트리밍돼 리다이렉트 상태를 바꿀 수 없다
 * — docs/architecture-guide.md §7.
 *
 * **서비스 표식을 셸이 갖는다** (#532). 이 그룹은 `AppShell` 밖이라 `GlobalHeader` 가
 * 없어서, 로그인·회원가입·비밀번호 찾기·소셜 콜백 넷 다 **어느 서비스의 로그인 창인지
 * 화면만 보고 알 수 없었다.** 표식이 페이지가 아니라 여기 있는 이유도 그것이다 — 넷이
 * 각자 그리면 자리와 크기가 갈린다.
 *
 * **장식이 아니라 홈으로 가는 링크다.** 이슈가 둘 중 하나를 고르라고 남겼는데, 장식으로
 * 두려면 `Wordmark` 가 **스스로 들고 있는** `role="img"` + `aria-label` 을 호출부에서
 * `aria-hidden` 으로 덮어야 한다 — 컴포넌트가 의도적으로 넣은 배선을 되돌리는 일이다.
 * 링크로 두면 그 배선이 그대로 이름이 되고, 무엇보다 **이 셸에 없던 출구가 생긴다**:
 * 지금까지 로그인 화면에서 서비스로 돌아갈 길이 하나도 없었다.
 *
 * **`aria-label` 을 링크에 다시 붙이지 않는다** — 스크린리더가 이름을 두 번 읽는다.
 * `GlobalHeader` 의 로고 링크와 같은 규칙이고, 근거는 브랜드 명세 B4 의 표에 있다.
 *
 * **락업(심볼 + 워드마크)을 그대로 쓴다.** B0 는 "인터페이스 안은 무채색" 이지만 **로고
 * 자리**를 예외로 두고 조건 셋(24px · `--brand-500` 하나 · 로고 자리에만)을 걸었다
 * (#240, `DESIGN.md` §1). 여기는 헤더가 없는 화면에서 헤더 로고가 서던 자리라 그 예외
 * 안이다 — 조건을 넓히지 않으려고 `BrandSymbol` 의 기본 크기를 그대로 둔다.
 *
 * **바닥(L0)을 칠하지 않는다.** 이 그룹은 `Canvas` 를 쓰지 않는 흰 화면이고, 표식을
 * 넣는다고 카드나 회색 바닥을 새로 들이지 않는다 — 폼 넷이 전부 좁은 중앙 열이다.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
      **표식과 폼을 한 묶음으로 가운데 세운다.** 예전에는 `<main>` 자신이
      `min-h-dvh justify-center` 를 들고 있었다. 표식을 그 안에 넣으면 사이트 수준
      내비게이션이 본문 랜드마크 안에 들어가고, `<main>` 밖으로 빼면 표식이 뷰포트 맨
      위에 박혀 폼과 **140px 넘게 벌어진다**(375×812 기준). 높이와 가운데 정렬을 바깥
      래퍼로 올리면 `<header>`(banner) · `<main>` 두 랜드마크를 제대로 두면서도 둘이
      `gap-8` 로 붙어 선다.

      내용이 뷰포트보다 길어도 잘리지 않는다 — `min-h-dvh` 는 고정 높이가 아니라
      최소값이라 래퍼가 내용만큼 자라고 `justify-center` 가 무효가 된다 (회원가입처럼
      긴 폼이 그 갈래다).
    */
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="flex justify-center">
        {/*
          44px — 모바일 최소 터치 영역 (DESIGN.md §7). 헤더 로고 링크와 같은 값이고,
          글자 크기가 아니라 히트 영역만 키운다.
        */}
        <Link
          href="/"
          className="text-fg focus-visible:ring-brand-500 inline-flex h-11 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandSymbol />
          <Wordmark />
        </Link>
      </header>

      <main>{children}</main>
    </div>
  )
}
