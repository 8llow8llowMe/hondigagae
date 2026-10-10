import Link from 'next/link'

import type { ReactNode } from 'react'

import { StateCharacter, type StateCharacterPose } from '@/components/character'
import { ChevronRightIcon } from '@/components/icons'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * Banner — 상시 진입점 (디자인 가이드 §5). 병원·약국 배너가 대표 사례다.
 *
 * **아이콘만 danger 색.** 배경을 붉게 칠하지 않는다 — 상시 진입점이지 경보가 아니다.
 * 붉은 면이 화면에 늘 떠 있으면 진짜 경보를 구분할 수 없게 된다.
 *
 * **자기 배경을 칠하지 않는다** (#428). 예전에는 `bg-bg` 로 흰 면을 스스로 그렸는데,
 * 2a 에서는 페이지가 이미 흰색이라 그 값이 하는 일이 없었고 3a 에서는 **해가 됐다** —
 * 각진 흰 면이 감싸는 `Surface` 의 radius 12 모서리를 덮어 카드가 사각으로 보였다.
 *
 * **`Surface` 에 `overflow-hidden` 을 주는 쪽으로 풀지 않았다.** 같은 카드 안
 * `ProfileCard` 의 반려견 스위처 팝오버가 `absolute z-40`(portal 아님)이라 잘린다.
 * 카드 안 자식은 자기 배경을 갖지 않는다 — 면은 `Surface` 가 소유한다.
 *
 * **모든 상태에서 남는다.** 오류·빈 화면에서도 제거하지 않는다 — 위급할 때 필요한
 * 진입점이 데이터 사정으로 사라지면 안 된다.
 *
 * 아트보드(`혼디가개 홈·내비게이션.dc.html`) 실측에 맞춘다 — 우측 꺾쇠가 있고(캐릭터가 서는
 * 배너는 꺾쇠 대신 캐릭터), 설명은 12/500 muted 이며, **위아래 테두리를 스스로 긋지 않는다.** 묶음의 경계는 담는 쪽이
 * 맡는다 — 3a 에서는 카드 경계와 `SurfaceStack` 간격이다 (DESIGN.md §0). 예전에는
 * `border-y` 를 하드코딩해 2a 의 8px 밴드와 선이 겹쳤다.
 */
export function Banner({
  title,
  /** 사실을 적는다 — "제주 24시간 병원은 3곳뿐이에요" */
  description,
  href,
  leading,
  character,
  /**
   * 좌우 여백. **레일(24)과 본문(40)은 1024 이상에서만 다르다** — 그 아래에서는 레일이
   * 레일이 아니라 한 컬럼의 한 블록이라 본문 인셋을 따른다 (장소 상세에서 겪은 것과 같다).
   */
  inset = 'main',
  className,
}: {
  title: string
  description?: string
  href: string
  /** 아이콘. 여기에만 danger 색을 쓴다 */
  leading?: ReactNode
  /**
   * 오른쪽 끝에 서는 캐릭터 (#939, DESIGN.md §0-5). **`leading` 과 따로 둔다** — 그 칸은 danger
   * 아이콘 자리라 `text-danger-500` 을 두르고, 위급 진입점의 신호다. 캐릭터가 그 칸을 쓰면
   * 상시 진입점이 병원 배너와 같은 모양이 된다. 허용 자리 목록 밖에서는 넘기지 않는다.
   *
   * **캐릭터가 서면 꺾쇠를 뺀다.** 둘이 나란히 서면 오른쪽 끝에 장식이 둘이라 어수선하고,
   * 레일 폭(362)에서 설명 줄이 꺾쇠 몫(32)만큼 밀려 두 줄로 접혔다(1024 · 1920 실측: 글 폭
   * 226 대 설명 228). 배너 한 줄 전체가 링크라 누를 자리는 그대로이고, 꺾쇠 몫은 캐릭터를
   * 키우는 데 쓴다(48 → 64).
   */
  character?: StateCharacterPose
  inset?: Inset
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'focus-visible:ring-brand-500 flex items-center gap-3 py-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        INSET_CLASS[inset],
        className,
      )}
    >
      {leading !== undefined && (
        <span aria-hidden className="text-danger-500 shrink-0">
          {leading}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-1 text-fg font-semibold">{title}</span>
        {description !== undefined && (
          // 12/500 muted — 아트보드 값이다. 본문(14)으로 올리면 제목과 무게가 비슷해진다
          <span className="text-caption text-fg-muted font-medium tabular-nums">{description}</span>
        )}
      </span>
      {/*
        **발을 카드 아랫선에 댄다** (`self-end -mb-4` = 링크의 `py-4`). 64px 개가 배너를 80 으로
        늘리지만 두 줄이던 글이 한 줄씩이 되어 글 덩어리 높이는 오히려 준다. 소개 페이지 캐릭터가
        절 끝선에 발을 대는 것과 같은 규칙이다(DESIGN.md §0-2).
      */}
      {character !== undefined ? (
        <StateCharacter pose={character} size="sm" className="-mb-4 self-end" />
      ) : (
        // 캐릭터가 없는 배너에서는 눌러서 이동한다는 것을 말하는 유일한 신호다
        <ChevronRightIcon size={20} aria-hidden className="text-fg-subtle shrink-0" />
      )}
    </Link>
  )
}
