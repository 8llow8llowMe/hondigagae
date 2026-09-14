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
 * 안이다.
 *
 * **여기서만 락업을 2배로 그린다** (심볼 48 · 워드마크 40×148 · gap 16, `DESIGN.md` §1 개정).
 * 24px 조건이 막으려던 것은 *"화면의 첫 시선을 데이터가 아니라 로고가 받는 것"* 인데
 * **이 넷에는 데이터가 없다** — 헤더도 없어 로고가 화면의 유일한 신원 단서이고, 헤더에서
 * 쓰던 크기 그대로 두면 그 단서가 폼 위에 붙은 각주처럼 읽힌다. 조건을 숫자가 아니라
 * **자리**로 다시 묶었고, 임의 크기는 `BrandSymbol` · `Wordmark` 의 `size` 열거가 막는다.
 *
 * **정확히 2배다 — 2.2배가 아니다.** 요청 범위(2.0~2.2배) 안에서 2.0 만 세 값이 전부
 * 정수로 떨어지고(48 / 40×148 / gap 16) 8px 스케일 위에 선다. 2.2 는 심볼이 52.8 이라
 * 반올림하는 순간 심볼:워드마크 비율이 원본(1.2)에서 어긋나 **락업이 미세하게 틀어진다**.
 * 375px 에서 실측한 락업 폭은 212px(내용 폭 343 의 62%)로, 2.2배(232px · 68%)와 화면
 * 인상 차이가 거의 없으면서 여백이 더 남는다.
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

          **`h-11` 이 아니라 `min-h-11` 이다.** 심볼이 48px 이라 고정 44px 안에서는
          위아래가 잘린다. 최소값으로 두면 기준(44)은 그대로 지키면서 내용이 더 클 때
          링크가 따라 자란다 — 래퍼의 `min-h-dvh` 와 같은 판단이다.
        */}
        <Link
          href="/"
          className="text-fg focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-4 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandSymbol size={48} />
          <Wordmark height={40} />
        </Link>
      </header>

      <main>{children}</main>
    </div>
  )
}
