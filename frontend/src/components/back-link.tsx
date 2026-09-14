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
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        'text-body-2 text-link hover:text-link-hover inline-flex h-11 items-center gap-1 font-semibold',
        'focus-visible:ring-brand-500 rounded-md focus-visible:ring-2 focus-visible:outline-none',
        /*
          **자리 이동을 노드 하나로 한다.** `flex-wrap` 부모(호출부 `header`)에서
          `basis-full` 은 한 줄을 통째로 차지하므로, 데스크톱에서는 지금처럼 제목 **위**에
          서고 모바일(`basis-auto`)에서는 제목 왼쪽에 붙는다.

          `md:hidden` / `hidden md:block` 으로 두 벌을 두지 않는다 — 라벨 문구가 두 곳이
          되면 아래 `sr-only` 가 지키려는 "이름의 출처는 하나" 가 무너진다.
        */
        titleRow && 'md:basis-full',
        // 라벨이 빠지면 가로가 아이콘 폭으로 쪼그라든다 — 세로(`h-11`)만으로는 44x44 가 안 된다
        titleRow && 'min-w-11 justify-center md:min-w-0 md:justify-start',
        className,
      )}
    >
      {/*
        **화살표의 모습이 variant 를 탄다.** `inline` 은 글자 흐름 안(장소 상세는 breadcrumb
        `장소 목록으로 › 제목`)에 서서 글리프가 글줄 baseline 에 맞는 편이 낫고, `titleRow` 는
        모바일에서 **아이콘 단독**이라 텍스트 글리프의 광학 중심이 폰트에 따라 흔들린다.
        둘을 `ChevronLeftIcon` 으로 합치는 안은 손대지 않기로 한 네 호출부의 모습을 바꾸므로
        #539 범위 밖이다 — breadcrumb 이 이미 옆에 `ChevronRightIcon` 을 두고 있어 합칠
        근거는 있다. 별도로 판단한다.
      */}
      {titleRow ? (
        <ChevronLeftIcon size={20} aria-hidden className="shrink-0" />
      ) : (
        <span aria-hidden>←</span>
      )}
      {/*
        **`aria-label` 을 쓰지 않는다.** 라벨을 DOM 에 두고 시각적으로만 감추면 접근성
        이름과 보이는 문구가 한 출처에서 나와 둘이 어긋날 수 없다 — `aria-label` 을 따로
        두면 문구를 고칠 때 한쪽만 고치는 사고가 나고, 그때 보이는 말과 읽히는 말이 갈린다.
        이름은 브레이크포인트와 무관하게 같다.
      */}
      <span className={cn(titleRow && 'sr-only md:not-sr-only')}>{label}</span>
    </Link>
  )
}
