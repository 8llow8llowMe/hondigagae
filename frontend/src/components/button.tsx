import Link from 'next/link'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

import { cn } from '@/lib/utils/cn'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dangerOutline'
  | 'kakao'
  | 'inverse'
  | 'inverseOutline'
export type ButtonSize = 'sm' | 'md' | 'lg'

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  /** 레이아웃 유틸리티만 허용한다. 색·radius·shadow·padding 덮어쓰기 금지 (component-guide.md §3) */
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * icon-only 버튼은 aria-label 을 타입으로 강제한다.
 * 주석으로 "붙이세요" 라고 쓰면 반드시 누락된다 — component-guide.md §7.
 */
type IconOnly = { iconOnly: true; 'aria-label': string; children?: never }
type WithLabel = { iconOnly?: false; children: ReactNode }

export type ButtonProps = BaseProps & (IconOnly | WithLabel)

const VARIANT: Record<ButtonVariant, string> = {
  // **`--brand-500` 이 아니다** (이슈 #61). 500 위 흰 글자는 3.49:1 이고 라벨은 16px/600 —
  // WCAG 대형(24px 또는 18.66px+bold)이 아니라 본문이라 4.5:1 이 필요하다. 600 은 5.27:1 이다
  primary: 'bg-brand-600 text-fg-inverse hover:bg-brand-700 active:bg-brand-700',
  secondary: 'border border-border-strong bg-bg text-fg hover:bg-band',
  ghost: 'text-fg-muted hover:bg-band',
  // 파괴 버튼 채움은 danger-700 이다 — 가이드 §5-2 ConfirmModal
  danger: 'bg-danger-700 text-fg-inverse hover:opacity-90',
  /*
    **되돌릴 수 없지만 그 화면의 주 행동은 아닌 파괴 액션.**

    `danger`(채움)는 확인 다이얼로그의 확정 버튼처럼 **그 순간의 주 행동**일 때 쓴다.
    화면 안에 그냥 놓여 있는 삭제 버튼까지 채우면 저장 버튼과 같은 무게로 붉게 서서
    시선을 먼저 끌고, 실제로 누를 일은 거의 없는 것이 화면에서 가장 강한 요소가 된다.

    글자는 `danger-900`(흰 배경 6.47:1) — DESIGN.md §2-6 이 "메뉴 안 파괴적 항목
    텍스트" 로 정의한 그 톤이고, 여기도 같은 성격(낮은 강조의 파괴 액션)이다.
    테두리 `danger-500` 은 비텍스트라 3:1 기준이고 4.53:1 로 통과한다.
  */
  dangerOutline: 'border border-danger-500 bg-bg text-danger-900 hover:bg-danger-100',
  /*
    **소셜 로그인 전용 — `DESIGN.md` §2-8 의 브랜드 예외.**

    `className` 으로 덮지 않고 변형을 추가한 이유는 `component-guide.md` §3 이 그렇게
    정했기 때문이다 ("금지 — 외형 덮어쓰기. **variant를 추가하거나** DESIGN.md를 갱신한다").
    카카오 노랑은 제공자 가이드가 고정한 값이라 호출부가 고를 수 있으면 안 된다.

    **네이버는 여기 없다.** 네이버 초록 채움 + 흰 글자는 **2.25:1 로 AA 미달**이라
    §2-8 이 흰 배경 변형을 쓰라고 못박았고, 그 변형의 외형(흰 면 + 1px 테두리 + 본문색
    글자)은 위 `secondary` 와 **같다.** 같은 것을 이름만 바꿔 하나 더 두지 않는다 —
    갈리는 것은 마크뿐이고 그것은 `NaverMark` 가 들고 있다.

    hover 는 `danger` 와 같은 `opacity-90` 이다. 노랑을 어둡게/밝게 만드는 순간
    "가이드가 고정한 값" 이 두 개가 되고, 각 사 가이드는 **버튼 색 변경을 금지**한다 —
    투명도는 색을 바꾸는 것이 아니라 눌림을 알리는 상호작용 피드백이다.
  */
  kakao: 'bg-kakao-bg text-kakao-fg hover:opacity-90 active:opacity-90',
  /*
    그린 밴드(`--brand-700`) 위에 서는 둘 — 소개 페이지(`/about`) 전용 (DESIGN.md §0-2, #635).
    `inverse` 는 흰 면 + `--brand-700` 글자(6.91:1), `inverseOutline` 은 투명 면 + 흰 글자 +
    흰 55% 테두리. hover 는 `inverse` 가 연녹(`--intro-band`), outline 이 흰 10% 채움 —
    둘 다 색을 새로 만들지 않는다.
  */
  inverse: 'bg-bg text-brand-700 hover:bg-intro-band active:bg-intro-band',
  inverseOutline:
    'border border-fg-inverse/55 text-fg-inverse hover:bg-fg-inverse/10 active:bg-fg-inverse/10',
}

/*
  **`sm` 은 보이는 높이 32 를 두고 누르는 자리만 44 로 넓힌다** (#905 R3). 투명한
  `::before` 가 위아래로 8px 씩 나간다. 기준 상자가 패딩 상자라 테두리 있는 variant
  (`secondary` · `dangerOutline` · `inverseOutline`)는 1px 씩 줄어 46, 테두리 없는 variant 는
  48 이다 — 6px 로 두면 42 라 44 에 못 미쳤다(#905 Playwright 실측). 일정 상세·긴급 화면의 `sm` 이 촘촘히 서는
  자리라 시각 크기를 올리면 밀도가 무너진다 — 그래서 보이는 것은 그대로다.

  `::before` 는 버튼 자신의 의사요소라 눌러도 이 버튼이 받는다. 위치를 잡지 않은 자식
  (`leading` 아이콘·글자) 위에 그려지지만 투명하고, 자식을 누르든 띠를 누르든 눌림은 이
  버튼으로 온다. **이웃 요소를 덮는다** — 띠는 positioned 라 DOM 순서와 무관하게 positioned
  가 아닌 이웃(글줄 등)보다 위에 그려지고, 위아래 7px 안의 글자를 누르면 이 버튼이 받는다.
  두 `sm` 이 세로로 7px 미만 간격이면 겹치는 띠는 뒤에 그려진 쪽이 받는다 — 세로로 촘촘히
  쌓는 자리(`gap-1`)에는 `sm` 을 두 개 잇달아 두지 않는다.
  사용처가 배치로 `absolute` 등을 주면 `cn()` 이 `relative` 를 걷고, 그것도 기준 상자라
  히트 영역은 그대로다.
*/
const SM_HIT_AREA =
  "relative before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"

const SIZE: Record<ButtonSize, string> = {
  sm: `h-8 gap-1 px-3 text-body-2 ${SM_HIT_AREA}`,
  // 높이 44 — §7 의 하한이 아니라 **폼 컨트롤 높이**다 (#883). 같은 줄의 입력·버튼이 서로 맞는 값이라 한쪽만 내리면 어긋난다
  md: 'h-11 gap-2 px-4 text-body-1',
  lg: 'h-12 gap-2 px-5 text-body-1',
}

const ICON_ONLY_SIZE: Record<ButtonSize, string> = {
  sm: `h-8 w-8 p-0 ${SM_HIT_AREA}`,
  md: 'h-11 w-11 p-0',
  lg: 'h-12 w-12 p-0',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leading,
  trailing,
  className,
  iconOnly,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      // form 안에서 의도치 않은 submit 을 막는다 (component-guide.md §7)
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-colors',
        /*
          **Tailwind v4 의 preflight 가 `button` 에 `cursor: default` 를 준다** — v3 까지는
          브라우저 기본값(`auto`)이라 아무것도 안 해도 손 모양이었는데, v4 로 오면서
          앱 안 모든 버튼이 화살표로 바뀌었다.

          그래서 **여기 한 곳에서 되돌린다.** 사용처가 `className="cursor-pointer"` 로
          붙이면 화면마다 붙은 것과 빠진 것이 갈리고, 그것은 `component-guide.md` §3 이
          말하는 "외형은 컴포넌트가 소유한다" 의 반대다.

          아래 `disabled:cursor-not-allowed` 가 이것을 이긴다 — `:disabled` 가 붙은 만큼
          선택자 명시도가 높아서, 순서와 무관하게 비활성 버튼은 금지 커서다.
        */
        'cursor-pointer',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        iconOnly === true ? ICON_ONLY_SIZE[size] : SIZE[size],
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
}

/**
 * 버튼 외형의 **이동** — `<Link>` 를 렌더한다.
 *
 * **`Button` 에 `href` 를 뚫지 않는다.** 버튼과 링크는 시맨틱이 다르고(스페이스 vs 엔터,
 * 새 탭·주소 복사·"링크 열기" 컨텍스트 메뉴), 한 컴포넌트가 둘을 오가면 호출부가 어느 쪽을
 * 만들고 있는지 알 수 없다. `PlaceBackLink` 주석이 같은 판단을 적어 뒀다.
 *
 * **외형 상수(`VARIANT` / `SIZE`)를 `Button` 과 공유하는 것이 이 컴포넌트의 존재 이유다.**
 * 이것이 없어서 화면 다섯 곳이 버튼 외형을 손으로 복제하고 있었다 — `--brand-500` 을 바꾸면
 * `button.tsx` 만 바뀌고 복제본은 그대로 남는다 (이슈 #70).
 *
 * `loading` · `disabled` 가 없다. **이동에는 그런 상태가 없다** — 비활성 링크가 필요하면
 * 그것은 링크가 아니라 버튼이다.
 */
/**
 * **속성을 최소로 받는다.** `AnchorHTMLAttributes` 를 통째로 `Link` 로 흘리면
 * `exactOptionalPropertyTypes` 아래에서 선택 속성의 `undefined` 가 `LinkProps` 와 충돌하고,
 * 애초에 지금 필요한 것은 이것뿐이다. **필요할 때 늘린다** (component-guide.md §6).
 */
type LinkBaseProps = {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  leading?: ReactNode
  trailing?: ReactNode
  /** 레이아웃 유틸리티만 허용한다. 색·radius·shadow·padding 덮어쓰기 금지 (component-guide.md §3) */
  className?: string
}

/**
 * `Button` 과 **같은 규칙으로** icon-only 를 타입으로 강제한다 — 아이콘은 `leading` 에
 * 넣고 `children` 은 두지 않는다.
 *
 * 이 유니온이 없으면 하이픈이 든 JSX 속성을 TypeScript 가 props 타입과 대조하지 않아
 * **`aria-label` 을 넘겨도 컴파일이 통과하고 값만 조용히 버려진다.** 아이콘 버튼에서
 * 접근 가능한 이름이 사라지는 것을 타입이 못 잡는 유일한 경로다.
 */
export type ButtonLinkProps = LinkBaseProps &
  (
    | { iconOnly: true; 'aria-label': string; children?: never }
    | { iconOnly?: false; children: ReactNode }
  )

export function ButtonLink(props: ButtonLinkProps) {
  const { href, variant = 'primary', size = 'md', leading, trailing, className, children } = props

  return (
    <Link
      href={href}
      aria-label={props.iconOnly === true ? props['aria-label'] : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        VARIANT[variant],
        props.iconOnly === true ? ICON_ONLY_SIZE[size] : SIZE[size],
        className,
      )}
    >
      {leading}
      {children}
      {trailing}
    </Link>
  )
}
