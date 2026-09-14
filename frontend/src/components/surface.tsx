import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 표면 프리미티브 — **3a 하나뿐이다** (이슈 #422 · #428 · #435 · #475).
 *
 * `Canvas`(L0 바닥) · `SurfaceStack`(카드 열) · `Surface`(L1 섹션) ·
 * `SurfaceList`(L2 카드 안 목록). `DESIGN.md §0` 이 정본이다.
 *
 * **두 체계가 한동안 공존했다.** 홈 한 화면(#428)만 3a 로 옮겨 검증하고 통과해야 §0 을
 * 개정하는 계획이었다 — 실패하면 3a 쪽만 지우면 되고 화면은 하나도 건드리지 않은
 * 상태였다. 게이트는 통과했고(#435) 로드맵 #455 가 화면 열하나를 옮겼다.
 * **2a 프리미티브(`Band` · `Section` · `Row` · `RowList`)는 그 전환이 끝난 뒤에 지웠다**
 * (#475) — 먼저 지웠다면 아직 옮기지 않은 화면이 함께 깨졌다.
 *
 * **2a(구 §0)가 무엇이었나 — 왜 걷었나.** 페이지가 흰색이고, 묶음의 경계는 8px 밴드
 * 하나가, 같은 묶음 안은 1px 구분선이 맡았다. 목록은 카드가 아니라 전폭 행이라 어떤
 * 요소에도 radius·shadow 가 없었다. 홈이 자라면서 **묶음을 표시할 장치가 밴드 하나뿐**
 * 이라는 것이 한계로 드러났다 — 좌우 2단에서 밴드의 y 좌표가 맞지 않고(어긋남 3건),
 * 섹션이 늘수록 "여기서 다른 이야기가 시작된다" 는 신호가 반복되며 닳는다.
 * **이 역사를 지우지 않는 이유는 같은 안이 다시 제안되기 때문이다** — 아이템마다 테두리를
 * 두르는 안을 기각한 근거까지 포함해 `DESIGN.md §0-1` 이 정본이다.
 *
 * **3a 는 면을 층으로 쌓는다.** 바닥(L0) → 섹션(L1) → 아이템(L2). 2a 의 문제의식은
 * 두 가지로 계속 지킨다 — **L1 에 그림자를 주지 않고**(눕는 것이지 뜨는 것이 아니다),
 * **L0 대비를 미묘하게 둔다**(#FFFFFF ↔ #F5F6F8). 대시보드로 읽히는 것은 그림자와
 * 강한 대비가 만든다.
 *
 * **미리 만들지 않는다.** #422 는 여기에 `SurfaceBody` · `SurfaceList` · `SurfaceRow` ·
 * `SurfaceTile` 넷을 더 두었는데, 홈을 실제로 옮겨 보니 **네 개 다 쓸 자리가 없어**
 * #428 에서 걷었다. 넷 다 "목록 화면에서 이렇게 쓰겠지" 라는 추측으로 만든 API 였고
 * 아무 화면도 그것을 검증하지 않았다 — 예컨대 `SurfaceRow` 의 `border-top + first` 는
 * 호출자가 한 번도 써 보지 않은 규약이다. 지금의 `SurfaceList` 는 장소 목록(#439)이
 * 실제로 요구해서 다시 만든 다른 것이다. **그 화면이 실제로 요구하는 모양**이 미리
 * 만들어 둔 추측보다 낫다.
 */

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
 *
 * **높이는 남는 만큼 먹는다 (`flex-1`, #456③).** 내용이 짧아도 바닥이 뷰포트 끝까지
 * 이어져야 한다 — 안 그러면 회색이 콘텐츠 높이에서 끊기고 그 아래로 흰 `body` 가 보여
 * "흰색은 바닥이 아니라 섹션의 색"(`DESIGN.md §0`)이 뒤집힌다. 채울 높이를 주는 쪽은
 * `app/(main)/layout.tsx` 의 세로 뼈대(`flex min-h-dvh flex-col`)다.
 *
 * **`100dvh - 헤더` 를 `.page-canvas`(globals.css)로 함께 준다 (#553).** 예전에는 이것을
 * 여기에 두지 않았다 — 푸터가 통째로 접힘 아래로 내려가 **없던 스크롤이 짧은 화면마다
 * 생긴다**는 이유였다. 그런데 `.rail-layout` 세 화면은 이미 같은 값을 갖고 있어서,
 * 실제로 생긴 것은 "스크롤이 없는 화면" 이 아니라 **회색 바닥이 끝나는 자리가 화면마다
 * 260px 씩 다른 상태**였다. 규칙을 둘로 두는 것보다 통일하는 쪽이 낫다.
 *
 * `flex-1` 은 그대로 둔다 — 내용이 그보다 길면 그쪽이 이긴다. 뼈대 밖에 놓인 `Canvas`
 * 에서는 flex 속성이 무시돼 아무 일도 일어나지 않는다 — 지금은 35곳 전부가 `as="main"`
 * 인 페이지 뿌리다.
 *
 * **폭은 `w-full` 로 못박는다 (#520).** 뼈대 안에서 이것은 flex 아이템인데,
 * **flex 아이템은 cross 축 margin 이 `auto` 면 `stretch` 가 무효가 되고 내용 폭으로
 * 줄어든 뒤 가운데 정렬된다.** 사용처가 `rail-layout`(= `margin-inline: auto` +
 * `max-inline-size`)을 이 요소에 직접 다는 네 라우트가 그렇게 깨졌다 — #484 가 `#main` 을
 * flex 열로 바꾼 뒤 1920 에서 `/places` 바닥이 1440 이 아니라 **707** 이었고 390 에서
 * `/plans` 는 **240** 이었다. `w-full` 이 cross 크기를 `auto` 밖으로 빼내 그 경로를 막는다.
 * `max-inline-size` 는 그대로 살아 1440 캡과 가운데 정렬이 유지된다.
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
    <Tag id={id} className={cn('page-canvas bg-bg-sunken w-full flex-1', className)}>
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
 * `gap-2`(8)로 바닥이 비치는데, 이 값이 **2a 의 8px 밴드와 같다** (#475 에서 삭제).
 */
export function SurfaceStack({
  id,
  children,
  className,
  ...rest
}: {
  /**
   * 건너뛰기 링크의 목적지가 될 때 준다 (#472) — `Canvas` 의 `id` 와 같은 이유다.
   *
   * **`tabIndex={-1}` 을 함께 준다** — 다만 *측정으로 증명된 것은 아니다.* Chromium 은
   * 이것이 없어도 앵커 목적지로 **순차 포커스 시작점**을 옮겨서, e2e 가 두 경우를
   * 구별하지 못한다(뮤테이션으로 확인). 보조기기·구형 브라우저 조합에서 포커스가
   * `body` 에 남는 사례가 알려져 있어 WAI 가 권하는 처방을 그대로 둔다.
   */
  id?: string
  tabIndex?: -1
  'aria-label'?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div {...rest} id={id} className={cn('flex flex-col gap-2 md:gap-6 md:p-6', className)}>
      {children}
    </div>
  )
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
 *
 * ### `fill` — 목록 패널 (이슈 #556)
 *
 * **도구가 카드 밖이라는 규칙의 갈래다.** §0 은 "필터·검색은 목록을 좁히는 **도구**이고
 * 카드는 그 **결과**를 담는다" 로 도구를 카드 밖에 두게 했다. 목록 4화면에서 그 규칙이
 * 실제로 만든 것은 **바닥 위에 떠 있는 글줄 두세 줄**이었고, 제목 자리가 화면마다 갈렸다
 * (바닥 위 · 카드 안 · 두 열 위 셋).
 *
 * `fill` 카드는 그 둘을 한 표면 안에서 **위아래로** 가른다 — 머리가 도구를, 본문이 결과를
 * 맡고 본문만 구른다. 도구와 결과가 갈려 있다는 §0 의 의도는 그대로이고, 갈리는 축만
 * "카드 안/밖" 에서 "머리/본문" 으로 옮긴다.
 *
 * **`lg` 전용이다.** 1024 미만에서는 레일이 없고 페이지 스크롤 하나라, 머리를 고정할 열
 * 높이 자체가 없다. 그 아래에서는 평범한 카드로 흐른다.
 */
export function Surface({
  title,
  titleId,
  description,
  lead,
  leading,
  tools,
  trailing,
  fill = false,
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
  /**
   * 제목 **위** 한 줄 — 담기 화면의 `일정으로 돌아가기` 하나가 쓴다 (#556).
   *
   * **이 화면의 유일한 퇴로라 머리 안이어야 한다.** 바닥 위에 두면 목록을 내려가는 동안
   * 화면 밖으로 사라지는데, `fill` 머리는 고정이라 늘 남는다.
   */
  leading?: ReactNode
  /**
   * 제목 줄 **아래**, 머리 안 — 검색 · 모바일 필터 칩 (#556).
   *
   * **`children`(결과)과 갈라 두는 것이 핵심이다.** 여기 든 것은 머리와 함께 고정되고
   * `children` 만 구른다. `fill` 이 아니면 그냥 제목 아래에 흐른다.
   */
  tools?: ReactNode
  /** 제목 우측 액션 (예: "전체 보기" · 보기 토글 · `새 일정 만들기`) */
  trailing?: ReactNode
  /**
   * 열 높이를 다 쓰고 **본문만 구른다** (#556). 머리주석의 `fill` 절이 정본이다.
   *
   * 짧은 목록에서는 카드 아래쪽에 빈 자리가 생긴다 — 네 화면이 같은 모양이 되는 값이
   * 그보다 크다고 봤다 (이슈 #556 의 결정 1).
   */
  fill?: boolean
  children: ReactNode
  className?: string
}) {
  const hasHead = title !== undefined || leading !== undefined || tools !== undefined

  return (
    <section
      {...aria}
      aria-labelledby={titleId}
      className={cn(
        'bg-bg border-border border-y md:rounded-lg md:border',
        // 열을 채우고 머리/본문으로 가른다 — `min-h-0` 이 없으면 본문이 트랙 밖으로 자란다
        fill && 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col',
        className,
      )}
    >
      {hasHead && (
        /*
          **아래 선은 `fill` 에만 있다.** 본문이 머리 밑으로 흘러 들어가므로 경계가 없으면
          글자가 머리에 닿은 채 사라진다. 구르지 않는 카드에는 필요 없다.
        */
        <div className={cn(fill && 'border-border shrink-0 border-b')}>
          <div
            className={cn(
              'px-4 md:px-5',
              /*
                **`fill` 머리는 위 여백이 16 이다** (기본 20). 보기 토글이 이 안으로
                들어오면서 지도 갈래의 떠 있는 토글보다 내려가는데, 4px 을 줄여 그 어긋남을
                줄인다 (이슈 #556 의 결정 3).

                **1920 실측: 지도 88 · 목록 105 로 17px 이다** (20 이었다면 21px). 목업에
                적었던 "17 → 13" 은 카드 테두리 1px 과 토글의 `items-start` 를 빼고 센
                값이라 4px 낙관적이었다 — 실측이 정본이다.

                **더 줄이지 않는다.** 0 으로 맞추려면 머리에 위 여백이 없어야 하는데 그러면
                제목이 테두리에 붙는다. 4px 을 더 깎는 것(12)보다 §4 스케일 위의 16 이 낫다.
              */
              fill ? 'pt-4' : 'pt-5',
              // 도구가 있으면 그쪽 위 여백이 간격을 진다 — 둘 다 두면 24 로 벌어진다
              tools === undefined && 'pb-3',
            )}
          >
            {/*
              **모바일에서 뒤로가기가 제목 **왼쪽**, 같은 줄에 선다** (#539). `flex-wrap` 이
              제목 덩어리를 다음 줄로 넘기지 않게 하려면 그 덩어리가 남은 폭을 다 먹어야
              한다(`flex-1`). `md` 이상은 `block` 으로 되돌려 예전처럼 제목 **위**에 선다 —
              #539 가 바꾸기로 한 것은 모바일뿐이다.

              `leading` 이 없으면 감싸지 않는다 — 빈 flex 컨테이너가 제목 줄의 `gap` 을
              괜히 하나 더 만든다.
            */}
            {leading !== undefined && (
              <div className="mb-2 flex flex-wrap items-start gap-x-1 md:mb-0 md:block">
                {leading}
                <div className="min-w-0 flex-1 md:mt-2 md:flex-none">
                  <HeadTitleRow
                    title={title}
                    titleId={titleId}
                    description={description}
                    lead={lead}
                    trailing={trailing}
                  />
                </div>
              </div>
            )}

            {leading === undefined && title !== undefined && (
              <HeadTitleRow
                title={title}
                titleId={titleId}
                description={description}
                lead={lead}
                trailing={trailing}
              />
            )}
          </div>

          {/*
            **도구는 머리의 좌우 여백 **밖**이다.** 검색 폼과 필터 칩은 자기 인셋을 스스로
            들고 있고(`INSET_CLASS.card`), 칩 줄은 그 위에 **음수 마진 bleed** 까지 얹어
            카드 끝까지 스크롤된다 (`place-filter-chips` 머리주석). 여기서 padding 을 한 번
            더 주면 글줄이 두 번 밀리고 bleed 계산이 어긋난다.
          */}
          {tools}
        </div>
      )}
      {fill ? (
        /*
          **여기만 구른다.** `overflow` 를 `lg` 로 좁히는 것은 그 아래에서 열 높이가 없어
          스크롤 컨테이너가 초점 링을 자르기만 하기 때문이다.
        */
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{children}</div>
      ) : (
        children
      )}
    </section>
  )
}

/**
 * 머리의 제목 줄 — 제목 + 부제 + 우측 액션.
 *
 * **`leading` 이 있고 없고에 따라 감싸는 곳이 달라서 뽑았다** (#556). 모바일 제목 줄
 * (#539)은 뒤로가기와 제목 덩어리를 `flex-wrap` 한 줄에 세우는데, 뒤로가기가 없는 세 화면은
 * 그 래퍼가 필요 없다 — 두 갈래가 같은 줄을 그리도록 한 곳에 둔다.
 */
function HeadTitleRow({
  title,
  titleId,
  description,
  lead,
  trailing,
}: {
  title: ReactNode
  titleId?: string | undefined
  description?: ReactNode
  lead?: boolean | undefined
  trailing?: ReactNode
}) {
  if (title === undefined) return null

  return (
    <div className="flex items-start justify-between gap-4">
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
  )
}

/**
 * **L2 — 카드 안 목록.** 구분선을 **항목 사이에만** 긋는다.
 *
 * **규약이 항목이 아니라 이 컨테이너에 있다.** 2a 의 전폭 행(#475 에서 삭제)은
 * `border-bottom` 을 행에 걸고 마지막 행이 `last` 로 껐다 — 그래서 **행 수를 아는
 * 호출자만 목록을 그릴 수 있었고**,
 * 홈에서 규약이 실제로 세 갈래로 갈렸다: 첫 행만 선을 빼는 곳(`place-insight-row`),
 * 모든 행에 거는 곳(`indoor-alternatives-section` · 적합도 스켈레톤), 그리고 카드 안에서
 * 페이지 인셋 40 을 쓰던 곳(`upcoming-plan-row`).
 *
 * `[&>li+li]` 는 **인접 형제에만** 걸려 첫 항목 위에 선이 생기지 않는다. 제목 아래 선은
 * 카드의 몫이지 목록의 몫이 아니다 — 그것까지 목록이 그리면 제목이 없는 카드에서
 * 허공에 선이 뜬다.
 *
 * **`ul`/`li` 로 내보내 스크린리더가 개수를 읽게 한다.** 항목은 `li` 여야 하고,
 * 좌우 인셋은 항목이 `INSET_CLASS.card` 로 준다 — 세로 여백이 항목마다 달라(썸네일 행 12,
 * 요약 행 20) 여기서 정할 수 없기 때문이다.
 *
 * #422 가 미리 만들었던 `SurfaceList` 와 **다른 것이다.** 그때는 `SurfaceRow` 가 스스로
 * `border-top + first` 를 그리는 짝이었고 아무 화면도 그것을 쓰지 않아 걷었다(#428).
 * 이번 모양은 장소 목록(#439)이 실제로 요구한 것이고, 홈의 세 호출처가 함께 들어온다.
 */
export function SurfaceList({
  columns = 1,
  children,
  className,
  ...aria
}: {
  'aria-busy'?: boolean | undefined
  'aria-label'?: string
  /**
   * **`xl`(1280) 부터 2열로 접는다.** 기본은 1열이다.
   *
   * 저장한 곳(`/favorites`, #462)이 요구한 변형이다 — 그 화면은 `content-container` 가
   * 없는 전폭이라 1440 에서 한 행이 1360까지 늘어나고, 그러면 장소명과 우측 해제 버튼이
   * 눈으로 이어지지 않는다 (아트보드 03 · 명세 D1).
   *
   * **규약은 여기 남는다.** 2a 때는 행이 `last`·`lastGridRow`·`columnDivider` 세 prop 으로
   * 스스로 선을 그었고, 그래서 **행 수와 자기 위치를 아는 호출자만** 목록을 그릴 수 있었다.
   * 2열에서 어긋나는 것은 두 군데뿐이라(첫 시각적 행의 오른쪽 칸 위선, 열 사이 세로선)
   * `.surface-list-2col`(globals.css) 이 그것만 바로잡는다.
   *
   * `columns` 를 `1 | 2` 로 좁혀 둔다 — 3열을 요구한 화면이 아직 없다. 필요해지는 화면이
   * 나오면 그때 넓힌다 (#422 에서 추측 API 넷을 걷은 이유다).
   */
  columns?: 1 | 2
  children: ReactNode
  className?: string
}) {
  return (
    <ul
      {...aria}
      className={cn(
        '[&>li+li]:border-border [&>li+li]:border-t',
        columns === 2 && 'surface-list-2col',
        className,
      )}
    >
      {children}
    </ul>
  )
}
