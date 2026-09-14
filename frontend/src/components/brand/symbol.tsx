import { cn } from '@/lib/utils/cn'

/**
 * 브랜드 심볼 — 발바닥(발가락 3개), 아트보드 `혼디가개 브랜드 자산` 1절.
 *
 * **헤더에 채도가 들어오는 것은 의도된 예외다** (#240). `DESIGN.md` §1 이
 * "채도를 데이터에만 남긴다" 고 정했고 이전에는 그 규칙을 헤더 로고까지 적용해
 * 워드마크만 썼다. 그 결정을 뒤집었으니 **판정 색과 경쟁하지 않게 하는 것이 조건**이다.
 *
 *  - 크기를 24px 로 묶는다. 여기서 커지면 헤더가 브랜드 배너가 된다
 *    - **`(auth)` 셸만 48px 을 쓴다** (`DESIGN.md` §1 개정). 24px 조건이 막으려던 것은
 *      "화면의 첫 시선을 데이터가 아니라 로고가 받는 것" 인데, 인증 화면에는 **데이터가
 *      없다** — 로고가 그 화면의 유일한 신원 단서다. 조건을 숫자가 아니라 **자리**로
 *      다시 묶어 `size` 를 열거로 제한한다: 임의 크기는 타입이 막는다
 *  - 색은 `--brand-500` 하나다. 판정 등급 색(`--metric-*`)을 쓰지 않는다 —
 *    브랜드가 등급을 말하게 되면 사용자가 로고를 신호로 읽는다 (브랜드 명세 B2)
 *  - 심볼은 **로고 자리에만** 둔다. 빈 상태·버튼·배지에 장식으로 흘리지 않는다
 *
 * 자산은 `docs/hondi_img/logo-lockup.svg` 의 심볼부와 같은 좌표다 — 파비콘·PWA
 * 아이콘과 같은 모양이라 탭·홈 화면에서 본 것을 헤더에서 다시 알아본다.
 */
export function BrandSymbol({
  size = 24,
  className,
}: {
  /** 24 = 헤더 · `(auth)` 셸 밖의 로고 자리. 48 = `(auth)` 셸 전용 (`DESIGN.md` §1) */
  size?: 24 | 48
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {/*
        **토큰으로 칠한다.** 원본 자산은 `#2E9B6B`·`#FFFFFF` 로 박혀 있지만 그 두 값이
        `--brand-500`·`--bg` 와 정확히 같다 (`src/styles/tokens.css`). 값을 박아 두면
        토큰과 두 곳으로 갈리므로 변수로 받는다 — `Wordmark` 가 `currentColor` 를 쓰는
        것과 같은 판단이다. 다만 여기서는 `currentColor` 를 쓸 수 없다: 헤더 링크의
        글자색(`--fg`)을 물려받으면 심볼이 무채색이 되어 예외의 의미가 사라진다.
      */}
      <rect width="32" height="32" rx="4" fill="var(--brand-500)" />
      <g fill="var(--bg)">
        <circle cx="16" cy="7.72" r="3.24" />
        <circle cx="7.84" cy="11.2" r="3.24" />
        <circle cx="24.16" cy="11.2" r="3.24" />
        <path d="M16 14.5c3.6 0 8.1 3 8.1 7.1 0 3.7-3.5 6.2-8.1 6.2s-8.1-2.5-8.1-6.2c0-4.1 4.5-7.1 8.1-7.1Z" />
      </g>
    </svg>
  )
}
