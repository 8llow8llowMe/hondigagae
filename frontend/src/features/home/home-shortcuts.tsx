import Link from 'next/link'

import type { ReactNode } from 'react'

import { EmergencyIcon, MapIcon, PlanIcon } from '@/components/icons'
import { Surface } from '@/components/surface'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 홈 바로가기 한 줄 — AI 일정 · 제주올레 · 동물병원 (#1356).
 *
 * **예전에는 전폭 배너 세 장이었다.** 375 에서 각 76~82px, 합쳐 약 250px 이 좌측 레일 끝에
 * 쌓였고, 한 컬럼에서는 그 셋이 `오늘 갈 만한 곳` 보다 먼저 섰다. 셋 다 **매일 보는 정보가
 * 아니라 가끔 누르는 진입점**이라 면적을 한 줄로 줄이고, 자리는 장소 추천 뒤로 옮겼다
 * (홈-세부명세 D1).
 *
 * **세 칸이 같은 모양이다.** 아이콘 · 이름 · 짧은 설명줄. 병원 칸만 설명줄이 상태에 따라
 * 바뀐다(`hospitalShortcutCaption`) — 칸 자체는 어떤 상태에서도 사라지지 않는다.
 *
 * **병원 아이콘만 danger 색이다.** 배너 시절 `leading` 자리가 병원 전용 danger 였던 규칙
 * 그대로다 — AI · 올레 칸까지 칠하면 상시 진입점이 경보처럼 읽힌다.
 *
 * **랜드마크를 늘리지 않는다.** `nav` 가 아니라 이름 붙은 목록이다 — 셸의 랜드마크는 헤더 1 ·
 * nav 2 로 정해져 있다 (`(main)/layout.tsx`).
 */
export function HomeShortcuts({
  aiPlanHref,
  hospitalCaption,
}: {
  /** 게스트는 `toLoginHref` 로 감싼 값이 온다 — 보호 경로라 로그인 뒤 돌아올 곳을 싣는다 */
  aiPlanHref: string
  hospitalCaption: string
}) {
  return (
    <Surface>
      <ul
        aria-label={messages.home.shortcutsLabel}
        className="divide-border grid grid-cols-3 divide-x"
      >
        <ShortcutItem
          href={aiPlanHref}
          icon={<PlanIcon size={24} className="text-brand-600" />}
          title={messages.home.aiPlanBannerTitle}
          caption={messages.home.aiPlanBannerDescription}
        />
        <ShortcutItem
          href="/olle"
          icon={<MapIcon size={24} className="text-brand-600" />}
          title={messages.walkCourse.bannerTitle}
          caption={messages.walkCourse.bannerDescription}
        />
        <ShortcutItem
          href="/emergency"
          icon={<EmergencyIcon size={24} className="text-danger-500" />}
          title={messages.home.emergencyTitle}
          caption={hospitalCaption}
        />
      </ul>
    </Surface>
  )
}

function ShortcutItem({
  href,
  icon,
  title,
  caption,
}: {
  href: string
  icon: ReactNode
  title: string
  caption: string
}) {
  return (
    <li className="flex">
      <Link
        href={href}
        className={cn(
          'flex min-h-11 w-full flex-col items-center gap-1 px-2 py-4 text-center',
          'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        )}
      >
        <span aria-hidden className="mb-1">
          {icon}
        </span>
        <span className="text-body-2 text-fg font-semibold break-keep">{title}</span>
        <span className="text-caption text-fg-muted font-medium break-keep tabular-nums">
          {caption}
        </span>
      </Link>
    </li>
  )
}
