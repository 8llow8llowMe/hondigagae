import Link from 'next/link'

import { ChevronLeftIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'

/**
 * 상위 화면으로 돌아가는 링크.
 *
 * `Button` 을 쓰지 않는 이유: 이동은 `<a>` 여야 새 탭·주소 복사·스크린리더 안내가
 * 성립한다. `Button` 에 `href` 를 뚫거나 버튼 외형을 복제하지 않는다
 * (component-guide.md §3 — 외형은 컴포넌트가 소유한다).
 *
 * `PlaceBackLink`(장소 상세)에만 있던 것을 마이페이지 하위 두 화면이 같은 모양을
 * 필요로 하면서 승격했다. **호출부가 바뀌지 않도록 `PlaceBackLink` 는 남기고 이것을
 * 쓰게 했다** — #79 가 `ConfirmModal` 을 `Modal` 위에 얹은 것과 같은 방식이다.
 */

/**
 * 돌아가기가 서는 자리 — 이슈 #539.
 *
 * - `inline`(기본): 제 줄을 차지하는 텍스트 링크. **지금까지의 모습 그대로다.**
 * - `titleRow`: 모바일에서 제목 줄 안의 아이콘, 데스크톱에서는 제목 위 텍스트 링크.
 *
 * **기본값이 옛 모습인 것이 핵심이다.** 이 컴포넌트는 공용이라 모습을 바꾸면 일곱 자리가
 * 전부 따라오는데, 그중 둘은 제목 줄이 아예 없다:
 *
 * - 장소 상세는 breadcrumb 의 첫 조각(`장소 목록으로 › 제목`)이다. 아이콘만 남으면
 *   `› 제목` 앞에 화살표가 떠 경로가 말이 안 된다.
 * - 마이페이지 하위 두 화면은 `h1` 이 `sr-only` 고 보이는 제목은 **카드 안** `h2` 다.
 *   뒤로가기는 L0(카드 밖)에 있어 "제목 줄 왼쪽" 이라는 자리가 성립하지 않는다 —
 *   3층 표면(#455)이 "뒤로가기는 어느 카드에도 속하지 않는다" 로 정해 둔 자리다.
 */
type BackLinkVariant = 'inline' | 'titleRow'

/**
 * variant 별 추가 클래스 — `component-guide.md` §11 ("`Record<Union, string>` 으로 맵을 선언").
 * 불리언 분기로 두면 세 번째 값이 생겼을 때 타입체커가 잡지 못한다.
 *
 * **`titleRow` 는 모바일에서만 다르다.** `md` 이상은 전부 `md:` 로 되돌려 `inline` 과 같은
 * 모습이 되므로, 데스크톱에서는 일곱 호출부가 지금까지처럼 한 모양이다.
 */
const VARIANT_CLASS: Record<BackLinkVariant, string> = {
  inline: '',
  titleRow: [
    /*
      **44px 를 상자 크기가 아니라 패딩으로 만든다** (DESIGN.md §7).

      `min-w-11 justify-center` 로 44px 를 만들면 아이콘이 상자 **가운데**로 밀려 잉크가
      글줄 세로선에서 15.5px 오른쪽에 선다(실측). 패딩으로 만들면 아이콘은 왼쪽에 남고
      터치 영역만 넓어진다 — 잉크는 `-ml-4` 와 합쳐 데스크톱 `←`(3.5px)와 같은 어긋남에 든다.
    */
    '-ml-4 px-3',
    /*
      **세로 레이아웃 상자를 제목 첫 줄에 맞춘다.** `h-11`(44) 그대로면 `ViewToggle`(46)이
      줄 높이를 키울 때 아이콘만 8px 아래로 내려가고, 제목이 두 줄이 되면 **두 줄 사이**에
      앉는다(실측). 음수 세로 마진으로 마진 상자를 제목 첫 줄 높이에 맞추면, 부모
      `items-start` 아래에서 중심이 저절로 맞는다. 터치 영역은 44 그대로다.

      **1px 어긋난다 — 의도다.** 딱 맞는 값은 `(44 − 30) / 2 = 7px` 인데
      (`--text-title-1--line-height` = 30px), 7 은 스케일 밖이라 arbitrary value 룰이 막는다.
      `-my-2`(8px)면 마진 상자가 28 이 되어 아이콘 중심이 글줄 중심보다 **1px 위**다.
      스케일을 벗어나는 것보다 1px 이 낫다 — #443 · #447 이 카드 테두리 1px 을 같은 이유로
      두고 간 자리다.
    */
    '-my-2',
    // 데스크톱은 옛 모습 그대로 — `-ml-1` 광학 보정, 패딩·음수 마진 없음
    'md:-ml-1 md:my-0 md:px-0',
  ].join(' '),
}

export function BackLink({
  href,
  label,
  variant = 'inline',
  className,
}: {
  href: string
  label: string
  variant?: BackLinkVariant | undefined
  /**
   * 레이아웃 유틸리티만 허용한다 (component-guide.md §3).
   *
   * `?:` 가 아니라 `| undefined` 인 이유는 `exactOptionalPropertyTypes` 다 — 감싸는
   * 컴포넌트가 자기 optional prop 을 그대로 넘길 수 있어야 한다.
   */
  className?: string | undefined
}) {
  const titleRow = variant === 'titleRow'

  return (
    <Link
      href={href}
      className={cn(
        // 높이 44 — §7 하한이 아니라 이 자리에서 고른 값이다 (#883). 줄이려면 375 에서 재고 줄인다
        'text-body-2 text-link hover:text-link-hover inline-flex h-11 items-center gap-1 font-semibold',
        'focus-visible:ring-brand-500 rounded-md focus-visible:ring-2 focus-visible:outline-none',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {/*
        **화살표는 브레이크포인트를 탄다 — variant 가 아니다.**

        처음에는 `titleRow` 전체를 `ChevronLeftIcon` 으로 뒀는데, 그러면 **데스크톱에서**
        일정 세 화면만 `‹` 가 되고 마이페이지·장소 상세는 `←` 로 남아 같은 자리·같은 문구가
        화살표만 갈린다. 바꾸기로 한 것은 모바일뿐인데 손대지 않기로 한 곳과의 불일치를
        새로 만든 셈이라 되돌렸다.

        둘 다 `aria-hidden` 이라 두 벌이어도 **이름의 출처는 여전히 하나**다 — 아래 `sr-only`
        라벨이 그 일을 혼자 한다. 노드를 두 벌 두지 않는 규칙은 이름을 가진 것에만 건다.
      */}
      {titleRow ? (
        <>
          <ChevronLeftIcon size={20} aria-hidden className="shrink-0 md:hidden" />
          <span aria-hidden className="hidden md:inline">
            ←
          </span>
        </>
      ) : (
        <span aria-hidden>←</span>
      )}
      {/*
        **`aria-label` 을 쓰지 않는다.** 라벨을 DOM 에 두고 시각적으로만 감추면 접근성
        이름과 보이는 문구가 한 출처에서 나와 둘이 어긋날 수 없다 — `aria-label` 을 따로
        두면 문구를 고칠 때 한쪽만 고치는 사고가 나고, 그때 보이는 말과 읽히는 말이 갈린다.
        이름은 브레이크포인트와 무관하게 같다. (`DESIGN.md` §9 의 icon-only 규칙 예외)

        `|| undefined` 로 빈 `class=""` 를 지운다 — `inline` 에서 `cn(false)` 가 `''` 를
        내면 React 가 `class=""` 를 렌더해, 손대지 않기로 한 네 호출부의 DOM 이 바뀐다.
      */}
      <span className={cn(titleRow && 'sr-only md:not-sr-only') || undefined}>{label}</span>
    </Link>
  )
}
