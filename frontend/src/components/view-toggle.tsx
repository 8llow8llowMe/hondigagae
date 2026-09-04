import Link from 'next/link'

import { ListIcon, MapIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * ViewToggle — 목록 ↔ 지도 세그먼트 컨트롤.
 *
 * 아트보드 `혼디가개 장소 찾기` 05 마지막 단락: **세 화면(장소 목록·장소 지도·긴급 시설)이
 * 같은 컨트롤을 쓴다.** 그래야 새로 배울 것이 없다.
 *
 * **버튼이 아니라 링크다.** 보기 방식은 URL(`?view=map`)이 소유하는 상태라
 * (architecture-guide.md §10) 공유·뒤로가기가 그대로 성립해야 하고, JS 가 아직 안 붙은
 * 순간에도 전환이 동작한다. 탭 전환은 사용자가 명시적으로 한 이동이므로 `push` 다 —
 * `Link` 의 기본 동작이 그것이다.
 *
 * 크기는 아트보드가 다르게 준다: **글자형 48 / 아이콘형 44.**
 *
 * **아이콘형이 기본이 됐다** (#240). 지도 위에 글자 버튼 두 개가 얹히면 지도를 가리고
 * 컨트롤처럼 보이지 않았다. 이름은 `aria-label`(보조기기)과 `title`(마우스 호버 툴팁)
 * 양쪽에 남긴다 — 아이콘만으로 목록/지도를 못 가리는 사용자가 있다.
 */
export function ViewToggle({
  current,
  listHref,
  mapHref,
  variant = 'icon',
  className,
}: {
  current: 'list' | 'map'
  listHref: string
  mapHref: string
  /** 기본은 `icon` 이다 — 세 화면이 같아 보이려면 호출부가 잊어도 갈리지 않아야 한다 */
  variant?: 'text' | 'icon'
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={messages.map.viewToggleLabel}
      className={cn(
        'border-border bg-bg inline-flex shrink-0 overflow-hidden rounded-lg border',
        className,
      )}
    >
      <Segment
        href={listHref}
        active={current === 'list'}
        variant={variant}
        label={messages.map.listView}
        srLabel={messages.map.showList}
        icon={<ListIcon size={20} />}
      />
      <Segment
        href={mapHref}
        active={current === 'map'}
        variant={variant}
        label={messages.map.mapView}
        srLabel={messages.map.showMap}
        icon={<MapIcon size={20} />}
        divider
      />
    </div>
  )
}

function Segment({
  href,
  active,
  variant,
  label,
  srLabel,
  icon,
  divider = false,
}: {
  href: string
  active: boolean
  variant: 'text' | 'icon'
  label: string
  srLabel: string
  icon: React.ReactNode
  divider?: boolean
}) {
  return (
    <Link
      href={href}
      // 현재 보기가 눌린 쪽이라는 것을 보조기기에도 남긴다.
      // `aria-current="page"` 는 라우트가 같아 부적절하다 — 같은 화면의 표현 전환이다
      aria-current={active ? 'true' : undefined}
      aria-label={variant === 'icon' ? srLabel : undefined}
      /*
        아이콘형에는 **호버 툴팁**을 준다. 브라우저 기본 툴팁이라 지연이 있지만, 자체
        툴팁 컴포넌트를 만들면 지도 위 z-index·터치 동작까지 떠안게 된다 — 아이콘 두 개를
        가리키는 데 그만한 무게는 필요 없다.
      */
      title={variant === 'icon' ? label : undefined}
      className={cn(
        'text-caption focus-visible:ring-brand-500 flex items-center justify-center font-semibold transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        variant === 'text' ? 'h-12 min-w-20 px-4' : 'size-11',
        divider && 'border-border border-l',
        active ? 'bg-fg text-bg' : 'text-fg-muted hover:text-fg',
      )}
    >
      {variant === 'text' ? label : icon}
    </Link>
  )
}
