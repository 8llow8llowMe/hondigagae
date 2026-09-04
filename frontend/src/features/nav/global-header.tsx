import Link from 'next/link'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'
import { ButtonLink } from '@/components/button'
import { EmergencyIcon } from '@/components/icons'
import { AccountMenu } from '@/features/nav/account-menu'
import { NavLinks } from '@/features/nav/nav-links'
import { PetSwitcherSlot } from '@/features/nav/pet-switcher-slot'

/**
 * 전역 헤더 — 아트보드 `01 홈`(모바일 56) / `02 홈`(데스크톱 64) / `03 전역 nav`.
 *
 * **서버 컴포넌트다.** 세션으로 분기하는 셸만 담당하고, 활성 판정(`usePathname`)과
 * 스위처 조회는 client 자식이 맡는다.
 *
 * 좌우 패딩 16(모바일) / 40(데스크톱). `max-width` 를 두지 않는다 — 헤더는 화면 폭을 쓴다.
 * 로고와 nav 사이 gap 32, nav 항목 사이 gap 4.
 *
 * **로고는 워드마크만이다** (아트보드 `혼디가개 브랜드 자산` 2절). 심볼(발바닥)을 붙이지
 * 않는다 — 가이드 0절의 무채색 원칙이 헤더 로고까지 적용된다.
 *
 * **`(auth)` 그룹에는 두지 않는다** — 이탈 경로가 되면 `returnTo` 흐름이 깨진다.
 *
 * 높이를 `<header>` 자신이 갖고 `box-border` 로 테두리를 그 안에 넣는다. 그래야 헤더가
 * 실제로 차지하는 높이가 `--header-h`(56/64)와 정확히 같아진다 — 안쪽 div 가 높이를
 * 가지면 border 1px 이 더해져 65px 이 되고, 그 1px 때문에
 * `calc(100dvh - var(--header-h))` 를 쓰는 `.rail-layout` 에 스크롤이 생긴다.
 */
export function GlobalHeader({ authed }: { authed: boolean }) {
  return (
    <header className="border-border bg-bg sticky top-0 z-30 box-border h-14 border-b md:h-16">
      <div className="flex h-full items-center justify-between gap-3 px-4 md:px-10">
        <div className="flex min-w-0 items-center gap-8">
          {/*
            **워드마크는 라이브 텍스트가 아니다** (아트보드 `브랜드 자산` 2절). 폰트
            로딩이 실패하면 헤더만 시스템 폰트로 튀어 로고가 로고처럼 안 보인다.
            `aria-label` 은 `Wordmark` 의 `<svg role="img">` 가 들고 있으므로 링크에
            다시 붙이지 않는다 — 스크린리더가 이름을 두 번 읽는다.
          */}
          <Link
            href="/"
            className="text-fg focus-visible:ring-brand-500 inline-flex h-11 shrink-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            {/*
              **심볼 + 워드마크 락업이다** (#240). `DESIGN.md` §1 이 채도를 데이터에만
              남기라고 정했고 이전에는 헤더에 워드마크만 두었는데, 그 결정을 뒤집었다 —
              근거와 조건은 §1 과 `BrandSymbol` 주석에 적었다. 조건은 크기(24px)와
              색(브랜드 하나)이고, 심볼은 로고 자리 밖으로 흘리지 않는다.

              **375 에서도 둘 다 둔다.** 24 + gap 8 + 74 = 106px 이고 그 폭에서 헤더의
              다른 것은 아이콘 두 개뿐이라 자리가 남는다 (375 실측: nav 를 밀지 않는다).
              폭을 조건으로 심볼을 숨기지 않는다 — 임의 breakpoint 는 이 저장소가 린트로
              막고, 스케일에 없는 폭을 새로 만들 이유도 없다.
            */}
            <BrandSymbol />
            <Wordmark />
          </Link>
          <NavLinks authed={authed} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* 모바일 헤더의 스위처. 데스크톱은 홈 프로필 카드가 맡는다 */}
          {authed && <PetSwitcherSlot />}

          {/* 상시 진입점. 아이콘만 danger 색이고 배경을 채우지 않는다 */}
          <Link
            href="/emergency"
            aria-label="병원 · 약국"
            className="text-danger-700 hover:bg-band focus-visible:ring-brand-500 inline-flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <EmergencyIcon size={24} />
          </Link>

          {authed ? (
            <AccountMenu />
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <ButtonLink href="/login" variant="ghost">
                로그인
              </ButtonLink>
              <ButtonLink href="/signup">회원가입</ButtonLink>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
