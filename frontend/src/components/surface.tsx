import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 표면 프리미티브 — **두 체계가 한동안 공존한다** (이슈 #422).
 *
 * | 체계 | 프리미티브 | 상태 |
 * |------|-----------|------|
 * | 2a (DESIGN.md §0 현행) | `Band` · `Section` · `Row` · `RowList` | 유지. 전 화면이 아직 이것을 쓴다 |
 * | 3a (개정안) | `Canvas` · `SurfaceStack` · `Surface` | 홈(#428)이 쓴다 |
 *
 * **2a 를 지우지 않는 것이 이 계획의 핵심이다.** 홈 한 화면(#428)만 3a 로 옮겨
 * 검증하고, 통과해야 DESIGN.md §0 을 개정한다. 실패하면 3a 쪽만 지우면 되고 화면은
 * 하나도 건드리지 않은 상태다.
 *
 * **3a 는 세 개뿐이다.** #422 는 여기에 `SurfaceBody` · `SurfaceList` · `SurfaceRow` ·
 * `SurfaceTile` 넷을 더 두었는데, 홈을 실제로 옮겨 보니 **네 개 다 쓸 자리가 없어**
 * #428 에서 걷었다. 넷 다 "목록 화면에서 이렇게 쓰겠지" 라는 추측으로 만든 API 였고
 * 아무 화면도 그것을 검증하지 않았다 — 예컨대 `SurfaceRow` 의 `border-top + first` 는
 * 호출자가 한 번도 써 보지 않은 규약이다.
 *
 * 목록·폼 화면을 옮길 때 **그 화면이 실제로 요구하는 모양으로** 다시 만든다.
 * 미리 만들어 둔 추측보다 그때의 요구가 낫다.
 *
 * ---
 *
 * **2a — 페이지는 흰색이다.** 회색 배경 위에 둥근 흰 카드를 띄우면 대시보드처럼 읽힌다.
 * 묶음의 경계는 8px `Band` 로만 끊고, 같은 묶음 안은 1px 구분선으로 잇는다. 목록은
 * 카드가 아니라 전폭 행이다. 그래서 2a 의 어떤 요소에도 radius·shadow 가 없다.
 *
 * **왜 2a 로 부족한가.** 묶음을 표시할 장치가 밴드 하나뿐이라 홈이 자라면서 두 가지가
 * 드러났다 — 좌우 2단에서 밴드의 y 좌표가 맞지 않고(어긋남 3건), 섹션이 늘수록
 * "여기서 다른 이야기가 시작된다" 는 신호가 반복되며 닳는다.
 *
 * **3a 는 면을 층으로 쌓는다.** 바닥(L0) → 섹션(L1) → 아이템(L2). 2a 의 문제의식은
 * 두 가지로 계속 지킨다 — **L1 에 그림자를 주지 않고**(눕는 것이지 뜨는 것이 아니다),
 * **L0 대비를 미묘하게 둔다**(#FFFFFF ↔ #F5F6F8). 대시보드로 읽히는 것은 그림자와
 * 강한 대비가 만든다.
 */

/**
 * 8px 밴드. **성격이 바뀌는 곳에만** 쓴다.
 *
 * "여기서 다른 이야기가 시작된다" 는 유일한 신호이므로, 같은 묶음 안의 항목을
 * 나눌 때 쓰면 신호가 죽는다. 그때는 `Row` 의 구분선이 맡는다.
 * 자료가 아니라 구분자라 `aria-hidden` 이다.
 */
export function Band({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-band h-2 w-full', className)} />
}

/**
 * 전폭 섹션. 라운드·그림자·테두리가 없다.
 *
 * 좌우 여백은 16(모바일) / 40(데스크톱) 이고, 이것이 구분선 인셋과 같은 값이라
 * `Row` 의 선이 제목과 같은 축에서 시작한다.
 */
export function Section({
  title,
  trailing,
  children,
  className,
}: {
  /** 없으면 제목 줄 자체를 렌더하지 않는다 */
  title?: ReactNode
  /** 제목 우측 액션 (예: "전체 보기") */
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('bg-bg w-full', className)}>
      {title !== undefined && (
        <div className="flex items-center justify-between gap-4 px-4 pt-6 pb-5 md:px-10">
          <h2 className="text-title-2 text-fg md:text-title-1 font-semibold md:font-bold">
            {title}
          </h2>
          {trailing}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * 전폭 행. 목록의 기본 단위다.
 *
 * 구분선은 `border-top` 이 아니라 **`border-bottom` + 마지막 행 제거**로 넣는다.
 * 좌우 인셋 16 / 40 을 주기 위해 선을 의사요소가 아니라 내부 래퍼에 건다 —
 * `border` 를 행 자체에 걸면 전폭으로 그어져 인셋이 사라진다.
 *
 * `selected` 는 tint 만 바꾼다. **행 높이나 테두리를 바꾸지 않는다** — 목록이 들썩인다.
 */
export function Row({
  as: Tag = 'div',
  selected = false,
  last = false,
  children,
  className,
}: {
  as?: 'div' | 'li'
  selected?: boolean
  /** 마지막 행이면 구분선을 그리지 않는다 */
  last?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <Tag className={cn(selected ? 'bg-row-selected' : 'bg-bg', className)}>
      <div className={cn('px-4 md:px-10', last ? '' : 'border-border border-b')}>{children}</div>
    </Tag>
  )
}

/**
 * 행을 담는 목록. `ul`/`li` 로 내보내 스크린리더가 개수를 읽게 한다.
 *
 * 마지막 행의 구분선은 사용처가 `<Row last>` 로 끈다. CSS 로 자동 처리하려면
 * 임의 variant(`[&>li:last-child>div]:border-b-0`)가 필요한데, 그러면 이 목록
 * 바깥에서 `Row` 를 단독으로 쓸 때 규칙이 안 먹어 두 경로가 갈린다.
 */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('bg-bg w-full', className)}>{children}</ul>
}

/* ══════════════════════════════════════════════════════════════════════════
   3a — 3층 표면 (이슈 #422). 아직 아무 화면도 쓰지 않는다.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * **L0 — 페이지 바닥.** 흰색이 바닥이 아니라 `Surface` 의 색이 된다.
 *
 * `--bg-sunken`(#F5F6F8)은 DESIGN.md §2-1 이 "모형 밖 자료 전용, 화면 안에서 쓰지
 * 않는다" 로 묶어 둔 토큰이다. 3a 가 푸는 것은 **그 용도 제한 하나뿐이고 값은 그대로다** —
 * 이 개정에 신규 토큰이 0개인 이유다.
 *
 * **대비를 더 벌리지 않는다.** #FFFFFF ↔ #F5F6F8 은 의도적으로 미묘하다. 여기서 회색을
 * 더 어둡게 하면 §1 의 "계측면처럼 중립적인 표면" 이 깨지고 2a 가 경계하던 대시보드가 된다.
 *
 * **바닥만 칠하고 배치는 하지 않는다.** 전폭이어야 하기 때문이다 — 콘텐츠 컨테이너
 * (`.rail-layout`, 최대 1440)에 걸면 그 바깥이 흰색으로 남는다. 카드를 쌓는 일은
 * `SurfaceStack` 이 맡는다.
 */
export function Canvas({
  as: Tag = 'div',
  id,
  children,
  className,
}: {
  /** 페이지 바닥이면 `main` 이다 — 바닥을 그리려고 래퍼를 하나 더 두지 않는다 */
  as?: 'div' | 'main'
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Tag id={id} className={cn('bg-bg-sunken', className)}>
      {children}
    </Tag>
  )
}

/**
 * **L0 위에 카드를 쌓는 열.** `Canvas` 와 갈라 둔 이유가 있다.
 *
 * 바닥은 **전폭**이어야 하고 쌓기는 **콘텐츠 폭 안**이어야 한다. 둘을 한 컴포넌트로
 * 두면 바닥이 콘텐츠 컨테이너를 따라가, 1440 컨테이너 바깥(1800 에서 좌우 177px)이
 * 흰색으로 남는다 — 실측으로 드러난 문제다. `Canvas` 는 `main` 에 걸어 화면 끝까지
 * 칠하고, 이 컴포넌트가 열 안에서 간격만 맡는다.
 *
 * 모바일은 좌우 여백이 없다 — `Surface` 가 전폭으로 내려앉기 때문이다. 세로 간격
 * `gap-2`(8)로 바닥이 비치는데, 이 값이 **2a 의 `Band` 와 같다.**
 */
export function SurfaceStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2 md:gap-6 md:p-6', className)}>{children}</div>
}

/**
 * **L1 — 섹션.** 제목을 가진 독립된 답 하나에만 준다.
 *
 * **카드 판정 3문** — 셋 다 "예" 여야 `Surface` 다.
 * 1. 자기 제목이 있는가? 2. 혼자 떼어놔도 말이 되는가? 3. 담는 항목이 둘 이상인가?
 *
 * 아니면 카드가 아니다: 페이지 머리(h1) · 전폭 미디어(지도·갤러리) · 상시 진입점(`Banner`) ·
 * 알림(`WeatherWarningStrip`) · 액션 바. **전부 카드로 만들면 전부 같은 무게가 되어
 * 위계가 다시 사라진다** — 그것이 항목마다 테두리를 두르는 안을 기각한 이유다.
 *
 * **radius 는 12(`--radius-lg`)이지 16 이 아니다.** 16(`--radius-xl`)은 모달·바텀시트·
 * 지도 위 패널이 이미 쓰고 있고(`bottom-sheet.tsx` · `modal.tsx` · `map-sheet.tsx` ·
 * `place-map-view.tsx`), DESIGN.md §5 가 그 용도로 지정한 값이다. L1 이 16 을 가져가면
 * **"이 곡률을 보면 떠 있는 것" 이라는 신호가 죽는다.** 규칙은 곡률이 클수록 더 떠 있다 —
 * 8 아이템 / 12 섹션·팝오버 / 16 오버레이. 섹션과 팝오버는 그림자로 갈린다.
 *
 * **그림자를 주지 않는다.** 섹션은 페이지 위에 눕지 뜨지 않는다 (DESIGN.md §6).
 * `token-usage.test.ts` 의 `FLOATING` 목록이 이것을 강제한다.
 *
 * **모바일(<768)은 전폭이다.** radius 와 좌우 테두리를 걷고 상하만 남긴다 — 390px 에서
 * 중첩 padding 은 내용 폭의 8.9%(358 → 326px)를 먹는다. §1 이 모바일 1순위라고 못박았다.
 *
 * **제목은 카드 안에 있다.** 밖에 두면 어느 묶음의 제목인지 모호해진다 — 지금 목록
 * 5화면이 전부 `<h1>` 을 목록 밖에 두고 있어 이 개정에서 안으로 들어온다.
 *
 * **카드 안 자식은 자기 배경을 갖지 않는다.** 각진 불투명 면이 radius 12 모서리를
 * 덮는다 — 병원 배너에서 실제로 났다(#428). `overflow-hidden` 으로 풀 수 없다:
 * 같은 카드 안 `ProfileCard` 의 팝오버가 `absolute`(portal 아님)라 함께 잘린다.
 *
 * 좌우 인셋은 `INSET_CLASS.card`(16/20)다. 페이지 인셋 40 을 카드 안에서 쓰면 내용이
 * 두 번 밀린다. 넘치는 스크롤러는 `INSET_BLEED_END_CLASS.card` 를 쓴다 — `rail` 의
 * 음수 마진을 쓰면 카드 테두리를 뚫는다.
 */
export function Surface({
  title,
  titleId,
  description,
  lead,
  trailing,
  children,
  className,
  ...aria
}: {
  /**
   * 제목 줄을 스스로 그리는 섹션이 쓴다 — 홈 판정은 라벨·등급어·체감온도가 한 줄이라
   * `title` 슬롯(제목 + 부제 + 우측 액션)에 맞지 않는다.
   * **`titleId` 와 함께 주지 않는다** — 접근성 이름이 둘이 된다.
   */
  'aria-label'?: string
  'aria-busy'?: boolean | undefined
  /** 없으면 제목 줄 자체를 렌더하지 않는다 */
  title?: ReactNode
  /**
   * `h2` 의 id. 사용처가 `aria-labelledby` 로 이 섹션을 가리킬 때 준다.
   *
   * **`aria-label` 로 대신하지 않는다** — 제목이 화면에 이미 있는데 같은 문자열을
   * 속성으로 또 적으면 두 곳이 갈린다.
   */
  titleId?: string
  /** 제목 아래 한 줄. `h2` 밖이라 `p` 를 넣어도 마크업이 깨지지 않는다 */
  description?: ReactNode
  /** 제목을 크게 쓰는 주 섹션 (홈 "오늘 갈 만한 곳") */
  lead?: boolean
  /** 제목 우측 액션 (예: "전체 보기") */
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      {...aria}
      aria-labelledby={titleId}
      className={cn('bg-bg border-border border-y md:rounded-lg md:border', className)}
    >
      {title !== undefined && (
        <div className="flex items-start justify-between gap-4 px-4 pt-5 pb-3 md:px-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className={cn(
                'text-title-2 text-fg font-semibold break-keep',
                lead ? 'md:text-display md:font-extrabold' : 'md:text-title-1 md:font-bold',
              )}
            >
              {title}
            </h2>
            {description !== undefined && <div className="mt-1">{description}</div>}
          </div>
          {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
