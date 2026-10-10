import { cn } from '@/lib/utils/cn'

/**
 * 앞에 놓인 구간을 건너뛰는 링크 — 이슈 #472.
 *
 * **평소에는 화면 밖에 있다가 포커스되면 제자리로 온다.** `sr-only` +
 * `focus:not-sr-only` 를 쓰지 않는다 — `not-sr-only` 의 `height: auto` 가 같은 variant 의
 * `h-11` 을 순서로 이겨 **포커스해도 1px 로 남는다** (전역 스킵 링크에서 실측으로 확인).
 * 화면 밖으로 밀어 두면 크기가 항상 유지된다.
 *
 * **애니메이션을 두지 않는다.** `translate` 는 `transition-transform` 이 걸지 않는 별도
 * 속성이고, 건너뛰기 링크는 즉시 나타나는 편이 낫다.
 *
 * **`fixed` 가 아니라 `absolute` 다.** 전역 스킵 링크(`app-shell.tsx`)는 문서 맨 앞이라
 * 뷰포트 좌상단이 제자리지만, 이것은 구간 앞에 놓이므로 **그 구간의 좌상단**에 떠야
 * 어디로 가는 링크인지 읽힌다. 담는 쪽이 `relative` 를 준다.
 */
export function SkipLink({
  href,
  children,
  className,
}: {
  href: string
  children: string
  className?: string
}) {
  return (
    <a
      href={href}
      className={cn(
        'bg-fg text-fg-inverse text-body-2 focus-visible:ring-brand-500 absolute start-2 top-2 z-30 inline-flex h-11 -translate-y-24 items-center rounded-md px-4 font-semibold focus:translate-y-0 focus-visible:ring-2',
        className,
      )}
    >
      {children}
    </a>
  )
}
