import Link from 'next/link'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'
import { ButtonLink } from '@/components/button'
import { EmergencyIcon } from '@/components/icons'
import { AccountMenu } from '@/features/nav/account-menu'
import { HeaderAboutLink } from '@/features/nav/header-about-link'
import { PetSwitcherSlot } from '@/features/nav/pet-switcher-slot'

/**
 * 헤더 두 벌(`GlobalHeader` 띠 · `IslandHeader` 알약, #1287)이 **같이 쓰는 조각**이다.
 *
 * 지도 아일랜드 헤더의 조건은 "로고 · 메뉴 이름 · 순서 · 로그인 버튼 모양 **동일**" 이다
 * (`docs/features/place/지도-아일랜드헤더-세부명세.md` D1-1). 두 헤더가 마크업을 따로 가지면
 * 한쪽만 고쳐지는 날 그 조건이 조용히 깨진다 — 그래서 **구조로** 지킨다. 메뉴는 원래부터
 * `NavLinks` 하나라 여기 없다.
 *
 * **서버 컴포넌트다.** 활성 판정 · 스위처 조회는 client 자식(`HeaderAboutLink` ·
 * `PetSwitcherSlot` · `AccountMenu`)이 맡는다.
 */

/**
 * 모바일 · 데스크톱이 **같은 라벨**을 쓴다 (#636). 같은 목적지가 폭에 따라 다른 이름을
 * 갖지 않게 한 자리에 둔다. `messages` 로 올리지 않는 이유는 이 헤더가 예전부터 리터럴을
 * 써 왔고, 키 하나를 새로 내려면 `회원가입` 까지 함께 옮겨야 해 이 이슈의 범위 밖이다.
 */
const LOGIN_LABEL = '로그인'

/**
 * 로고 링크 — 심볼 + 워드마크 락업.
 *
 * **워드마크는 라이브 텍스트가 아니다** (아트보드 `브랜드 자산` 2절). 폰트 로딩이 실패하면
 * 헤더만 시스템 폰트로 튀어 로고가 로고처럼 안 보인다. `aria-label` 은 `Wordmark` 의
 * `<svg role="img">` 가 들고 있으므로 링크에 다시 붙이지 않는다 — 스크린리더가 이름을 두 번 읽는다.
 *
 * **심볼 + 워드마크 락업이다** (#240). `DESIGN.md` §1 이 채도를 데이터에만 남기라고 정했고
 * 이전에는 헤더에 워드마크만 두었는데, 그 결정을 뒤집었다 — 근거와 조건은 §1 과 `BrandSymbol`
 * 주석에 적었다. 조건은 크기(24px)와 색(브랜드 하나)이고, 심볼은 로고 자리 밖으로 흘리지 않는다.
 *
 * **375 에서도 둘 다 둔다.** 24 + gap 8 + 74 = 106px 이고 그 폭에서 헤더의 다른 것은 아이콘
 * 두 개뿐이라 자리가 남는다 (375 실측: nav 를 밀지 않는다). 폭을 조건으로 심볼을 숨기지
 * 않는다 — 임의 breakpoint 는 이 저장소가 린트로 막고, 스케일에 없는 폭을 새로 만들 이유도 없다.
 */
export function HeaderLogo() {
  return (
    <Link
      href="/"
      className="text-fg focus-visible:ring-brand-500 inline-flex h-11 shrink-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <BrandSymbol />
      <Wordmark />
    </Link>
  )
}

/** 헤더 오른쪽 묶음 — 스위처 · 모바일 로그인 · 긴급 · 계정(또는 소개 · 로그인 · 회원가입) */
export function HeaderActions({ authed }: { authed: boolean }) {
  return (
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

        **지도 아일랜드 알약에서도 둔다** (#1287 D8-2 결정 A). 바로 아래 `병원·약국` 토글(#1286)과
        이름이 닮았지만, 이 링크는 지도에서 `/emergency` 로 가는 유일한 길이다.
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
          {/*
            **nav 밖 안내 링크** (#964 · 전역nav-세부명세 D4-5). 홈 소개 카드는 닫거나
            `/about` 을 한 번 열면 다시 서지 않아, 그 뒤 데스크톱에서 소개로 가는 길이
            푸터 하나뿐이었다. nav(`DESKTOP_NAV_ITEMS`)는 전부 "할 일" 이라 넣지 않고
            `로그인` 왼쪽에 둔다. **1024 이상만**이다 — 768 의 헤더 여유는 27px 이다.
            비로그인 갈래 안이라 로그인하면 서지 않는다.
          */}
          <HeaderAboutLink />
          <ButtonLink href="/login" variant="ghost">
            {LOGIN_LABEL}
          </ButtonLink>
          <ButtonLink href="/signup">회원가입</ButtonLink>
        </div>
      )}
    </div>
  )
}
