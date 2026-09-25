import Link from 'next/link'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'
import { ButtonLink } from '@/components/button'
import { EmergencyIcon } from '@/components/icons'
import { AccountMenu } from '@/features/nav/account-menu'
import { NavLinks } from '@/features/nav/nav-links'
import { PetSwitcherSlot } from '@/features/nav/pet-switcher-slot'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 모바일 · 데스크톱이 **같은 라벨**을 쓴다 (#636). 같은 목적지가 폭에 따라 다른 이름을
 * 갖지 않게 한 자리에 둔다. `messages` 로 올리지 않는 이유는 이 헤더가 예전부터 리터럴을
 * 써 왔고, 키 하나를 새로 내려면 `회원가입` 까지 함께 옮겨야 해 이 이슈의 범위 밖이다.
 */
const LOGIN_LABEL = '로그인'

/**
 * 전역 헤더 — 아트보드 `01 홈`(모바일 56) / `02 홈`(데스크톱 64) / `03 전역 nav`.
 *
 * **서버 컴포넌트다.** 세션으로 분기하는 셸만 담당하고, 활성 판정(`usePathname`)과
 * 스위처 조회는 client 자식이 맡는다.
 *
 * 좌우 패딩은 **`INSET_CLASS.main`(16/40)을 참조한다** — 문자열을 다시 적지 않는다 (#386).
 * 헤더는 화면 하나가 아니라 제품 전체에 서는 바라 페이지 인셋을 따르고, 그 값이 곧
 * 왼쪽 세로 기준선이다. 레일은 오른쪽만 24 로 좁히므로 왼쪽에서 헤더와 갈리지 않는다
 * (근거는 `lib/ui/inset.ts`).
 *
 * **바(`<header>`)에는 `max-width` 를 두지 않는다** — 캡하면 `border-b` 가 화면 가운데서
 * 끊긴다. 안쪽 div 만 `.content-container` 로 캡해 본문(`.rail-layout`)과 같은 세로
 * 경계에 선다 (#376).
 * 로고와 nav 사이 gap 32, nav 항목 사이 gap 4.
 *
 * **로고는 워드마크만이다** (아트보드 `혼디가개 브랜드 자산` 2절). 심볼(발바닥)을 붙이지
 * 않는다 — 가이드 0절의 무채색 원칙이 헤더 로고까지 적용된다.
 *
 * **`(auth)` 그룹에는 두지 않는다** — 이탈 경로가 되면 `returnTo` 흐름이 깨진다.
 *
 * **`z-40` 이다 — 지도 위 플로팅 컨트롤(`z-30`)보다 위다** (#393). `sticky` + `z-index` 는
 * **쌓임 맥락을 만든다.** 헤더가 `z-30` 이던 동안 안쪽 드롭다운(`Menu` · `PetSwitcher`)의
 * `z-40` 은 그 맥락 **안에서만** 유효했고, 바깥에서 헤더 전체는 여전히 30 이었다. 지도
 * 컨트롤도 30 이라 같은 층에서 DOM 순서가 승패를 갈랐고 — 지도가 뒤에 온다 — `/emergency`
 * 에서 계정 드롭다운이 보기 전환 토글 **아래**로 깔렸다. 값을 올려야 하는 것은 드롭다운이
 * 아니라 **헤더 자신**이다.
 *
 * 높이를 `<header>` 자신이 갖고 `box-border` 로 테두리를 그 안에 넣는다. 그래야 헤더가
 * 실제로 차지하는 높이가 `--header-h`(56/64)와 정확히 같아진다 — 안쪽 div 가 높이를
 * 가지면 border 1px 이 더해져 65px 이 되고, 그 1px 때문에
 * `calc(100dvh - var(--header-h))` 를 쓰는 `.rail-layout` 에 스크롤이 생긴다.
 */
export function GlobalHeader({ authed }: { authed: boolean }) {
  return (
    <header className="border-border bg-bg sticky top-0 z-40 box-border h-14 border-b md:h-16">
      <div
        className={cn(
          'content-container flex h-full items-center justify-between gap-3',
          INSET_CLASS.main,
        )}
      >
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

          {/*
            **모바일 미로그인 진입점** (#636 · 홈-첫방문-판정-세부명세 D1). 아래 `로그인 ·
            회원가입` 쌍이 `md:flex` 라 768 미만에서는 헤더에 로그인으로 가는 길이 하나도
            없었다 — 탭바에도 없다(`menu-items.ts`). 첫 화면에서 서비스에 들어오는 문이
            닫혀 있던 셈이다.

            **버튼이 아니라 텍스트 링크다.** 이 폭의 주 행동은 홈 카드 안 `반려견 등록`
            버튼이고(D1), 헤더에 같은 무게의 면을 하나 더 두면 첫 화면에 주 버튼이 둘이
            된다. 로고 · 응급 아이콘과 같은 줄에서 밀도를 키우지 않는 쪽을 고른다.

            **응급 아이콘 왼쪽이다.** 응급은 상시 진입점이라 오른쪽 끝 자리가 고정이다.

            `ButtonLink` 를 `md:hidden` 으로 쓰지 않는다 — 크기·면을 다시 덮어써야 하고,
            그 덮어쓰기는 `className` 규약이 막는다 (`component-guide.md`).
          */}
          {!authed && (
            <Link
              href="/login"
              className="text-body-2 text-link focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md px-2 font-semibold focus-visible:ring-2 focus-visible:outline-none md:hidden"
            >
              {LOGIN_LABEL}
            </Link>
          )}

          {/*
            상시 진입점. 아이콘만 danger 색이고 배경을 채우지 않는다.

            **lg 이상에서는 글자를 붙인다** (#913). 아이콘 하나로는 "병원·약국" 이라는 것이
            처음 온 사람에게 읽히지 않았다 — 구급상자 모양이 약국인지 응급실인지 설정인지
            갈린다. 자리가 남는 폭에서만 붙이고, 1024 미만은 아이콘 그대로다(헤더 한 줄에
            nav 가 없어 폭은 남지만 탭바가 같은 일을 한다). 글자는 `text-fg` 다 — 붉은
            글자는 경보로 읽힌다. `aria-label` 은 보이는 글자와 같은 문자열이라 음성 제어가
            보이는 그대로 부를 수 있다(WCAG 2.5.3).
          */}
          <Link
            href="/emergency"
            aria-label="병원 · 약국"
            className="text-danger-700 hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md focus-visible:ring-2 focus-visible:outline-none lg:px-3"
          >
            <EmergencyIcon size={24} />
            <span className="text-body-2 text-fg hidden font-semibold lg:inline">병원 · 약국</span>
          </Link>

          {authed ? (
            <AccountMenu />
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <ButtonLink href="/login" variant="ghost">
                {LOGIN_LABEL}
              </ButtonLink>
              <ButtonLink href="/signup">회원가입</ButtonLink>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
