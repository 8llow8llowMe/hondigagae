import { Surface, SurfaceStack } from '@/components/surface'
import type { Block, LegalDocument } from '@/lib/legal/types'
import { messages } from '@/lib/messages'
import { INSET_BLEED_END_CLASS, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 약관·개인정보 처리방침 렌더러 — 이슈 #610.
 *
 * **서버 컴포넌트다.** 상태도 세션 분기도 없다 — 두 문서가 같은 트리 모양을 쓰므로
 * 화면을 둘로 만들지 않는다.
 *
 * **`dangerouslySetInnerHTML` 을 쓰지 않는다.** 본문이 마크다운이 아니라 구조체라
 * HTML 문자열을 만들 일이 없다 (설계 명세 S5).
 *
 * **prop 이름이 `document` 가 아니라 `doc` 이다** — 전역 `document` 를 가리는 이름은
 * 브라우저 API 를 쓰는 코드가 이 파일에 들어올 때 조용히 틀린다.
 *
 * ### 3층 표면에 늦게 가입했다
 *
 * #610 은 이 화면을 **L0 회색 바닥 위 맨 글줄**로 두었다. 로드맵 #455 가 화면 열하나를
 * 3a 로 옮길 때 약관 두 장이 빠져 있었고, 그 결과 제품에서 **본문이 카드 밖에 있는 유일한
 * 화면**이었다 — `DESIGN.md §0` 의 "흰색은 바닥이 아니라 섹션의 색" 이 여기서만 뒤집혀 있었다.
 *
 * 함께 딸려 온 것이 폭이다. `.rail-layout` 에 가입하지 않아 **1440 캡이 없었고**, 1920
 * 에서 한 글줄이 1840px 이었다(실측). 법률문서는 이 제품에서 가장 긴 산문이라 그 폭이
 * 가장 아프게 걸리는 자리다.
 *
 * ### 목차는 **좌측** 레일이다
 *
 * `DESIGN.md §7-1` 이 레일 축을 왼쪽으로 못박았다 — 400(맥락) · 280(필터) 둘 다 좌측이고,
 * 왼쪽 인셋은 제품이 하나로 쓰는 기준선이다. 오른쪽 레일은 이 화면 하나만 갖는 새 축이 된다.
 * 선례도 왼쪽에 있다 — 일정 상세의 `PlanVerdictToc` 가 같은 400 레일에 선 목차 카드다.
 *
 * **`lg` 미만에서는 목차가 사라지지 않고 제목과 본문 사이에 선다.** 그래서 `.rail-layout`
 * 이 아니라 `.rail-layout-detail` 변형을 쓴다 — DOM 은 `머리 → 목차 → 본문` 한 줄이고,
 * 데스크톱에서만 grid 가 목차를 좌측 열로 보낸다. 트리를 폭마다 둘로 나누면 같은 목차가
 * 두 번 렌더돼 스크린리더가 중복해 읽는다 (`globals.css` 의 `.rail-layout-detail` 주석).
 *
 * ### 본문은 **카드 한 장**이다
 *
 * 조문마다 카드를 주지 않는다. 열다섯 조는 한 문서의 조항이지 열다섯 개의 답이 아니고,
 * 8px 회색 틈이 조문마다 끼면 한 문서가 카드 열다섯 장의 피드로 읽힌다. 조문 경계는 L2
 * 구분선이 긋는다 (§0 — 카드 경계는 **묶음**의 경계다).
 *
 * **개정 이력만 카드를 따로 받는다.** 문서 본문이 아니라 그 문서에 대한 메타라
 * 묶음이 다르다 — 예전에도 `border-t` 로 갈라 두었던 자리다.
 */

/**
 * 머리 카드가 `aria-labelledby` 로 가리키는 `h1` 의 id.
 *
 * **문서마다 다르게 만들지 않는다** — 한 페이지에 문서는 하나이고, `doc.id` 를 섞으면
 * 같은 화면의 같은 자리를 부르는 이름이 라우트마다 갈린다.
 */
const HEADING_ID = 'legal-document-title'

/**
 * 표는 좁은 화면에서 자기 스크롤러를 갖는다 — 그러지 않으면 페이지가 통째로 넘친다.
 *
 * **넘침은 카드 끝까지다** (`INSET_BLEED_END_CLASS.card`). 카드 인셋 안에서 멈추면
 * 표의 마지막 열이 글줄 여백에 잘려, 더 있다는 신호가 카드 테두리 안쪽에서 끝난다.
 * 왼쪽으로는 흘리지 않는다 — 첫 열(항목명)이 글줄 세로선에 서 있어야 한다.
 */
function BlockView({ block }: { block: Block }) {
  if (block.kind === 'text') {
    return <p className="text-body-1 text-fg-muted">{block.text}</p>
  }

  if (block.kind === 'list') {
    return (
      <ul className="text-body-1 text-fg-muted flex list-decimal flex-col gap-1 pl-5">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  return (
    <div className={cn('overflow-x-auto', INSET_BLEED_END_CLASS.card)}>
      <table className="text-body-2 w-full border-collapse text-left">
        <thead>
          <tr className="border-border border-b">
            {block.headers.map((header) => (
              <th key={header} scope="col" className="text-fg py-2 pr-4 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-border border-b last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="text-fg-muted py-2 pr-4 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  const { articleLabel, tocLabel, effectiveDateLabel, historyLabel } = messages.legal

  return (
    <div className="rail-layout rail-layout-detail">
      {/*
        ① 문서 머리 — 우측 열 첫 행. **카드다.**

        §0 은 "페이지 머리(h1)는 카드가 아니다" 로 시작하지만, 그 규칙이 지키려는 것은
        **모든 것을 카드로 만들어 위계가 사라지는 것**이다. 이 화면은 머리 아래가 전부
        흰 카드라, 머리만 회색 바닥에 얹히면 **화면의 이름이 가장 덜 중요해 보인다** —
        장소 상세가 #531 에서 같은 이유로 갤러리·제목을 카드로 올렸다.

        판정 3문을 다시 물으면 셋 다 "예" 다: ① `h1` 이 여기 있다 ② 문서의 이름과 시행일은
        그것만으로 "무슨 문서인가" 를 답한다 ③ 제목과 시행일 둘이다.

        **카드 이름은 `titleId` 로 `h1` 을 가리킨다** — `aria-label` 로 같은 문자열을 다시
        적으면 두 곳이 갈린다 (`Surface` 머리주석).
      */}
      {/* 열 사이 24 — 마주 보는 쪽만 절반을 낸다 (globals.css `.rail-layout` 주석, #559) */}
      <SurfaceStack className="rail-detail-main lg:pl-3">
        <Surface titleId={HEADING_ID}>
          {/* 세로 여백은 조문 블록과 같은 20 — 같은 열의 카드끼리 리듬이 갈리지 않는다 */}
          <header className={cn('flex flex-col gap-2 py-5', INSET_CLASS.card)}>
            <h1
              id={HEADING_ID}
              className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold"
            >
              {doc.title}
            </h1>
            <p className="text-body-2 text-fg-muted">
              {effectiveDateLabel} {doc.effectiveDate}
            </p>
          </header>
        </Surface>
      </SurfaceStack>

      {/*
        ② 목차 — 좌측 레일.

        **`rail-sticky` 를 쓰지 않는다.** 그 클래스는 `max-block-size: 100dvh - 헤더` +
        `overflow-y: auto` 라, 레일이 가용 높이보다 조금만 길어도 **카드 안에 세로 막대가
        하나 더 생긴다** — 페이지 막대 옆에 막대가 둘이고, 더 있다는 신호가 카드 테두리
        안쪽에서만 보인다. #598 이 목록 화면 레일에서 같은 처방을 걷은 이유다.

        대신 홈 맥락 레일과 같은 `lg:sticky lg:top-16 lg:self-start` 를 쓴다 — 레일은 언제나
        제 길이대로 서고, 클리핑이 없으므로 넘치는 몫은 grid 행(= 우측 본문 3300px)이 받는다.

        **치르는 값**: 창 높이가 `레일 + 64` 보다 낮으면 고정된 레일의 아래쪽이 화면 밖에
        남는다 — 페이지를 굴려도 레일은 고정이라 올라오지 않는다. 그래서 레일을 그 안에
        들어오는 높이로 잡는다 (아래 목차 줄 높이 주석이 실측과 임계값을 갖고 있다).
        **조문을 한참 더하면 그 임계값이 다시 올라간다** — 그때 이 선택을 다시 본다.

        위 여백 — 모바일은 앞 스택과 8(카드 간격), 태블릿 한 컬럼은 앞 스택의 아래 24 가
        이미 있어 0, 데스크톱은 자기 열의 첫 요소라 24 다 (장소 상세 판정 레일과 같은 값).
      */}
      <SurfaceStack className="rail-detail-aside pt-2 md:pt-0 lg:sticky lg:top-16 lg:self-start lg:pt-6 lg:pr-3">
        <Surface>
          {/*
            **카드가 곧 목차라 이름을 두 번 붙이지 않는다** — `Surface` 의 `title` 슬롯을
            쓰지 않는 이유다. 그 슬롯은 `h2` 를 title-2/title-1(28)로 그리는데, 이 화면의
            조문 제목이 body-1(16)이라 목차 라벨이 조문보다 커지고 `h1` 과도 같은 크기가 된다.
            `nav` 의 `aria-label` 이 랜드마크 이름을 맡고, 보이는 라벨은 그 안의 `h2` 다.
          */}
          <nav aria-label={tocLabel}>
            <h2 className={cn('text-body-2 text-fg-muted py-4 font-semibold', INSET_CLASS.card)}>
              {tocLabel}
            </h2>
            {/* 줄은 카드 안 L2 규약 — 위 1px 선으로 라벨과 갈리고 사이는 인접 형제만 긋는다 */}
            <ol className="border-border [&>li+li]:border-border border-t [&>li+li]:border-t">
              {doc.articles.map((article) => (
                <li key={article.no}>
                  {/*
                    **모바일에서 행 높이 44** — 손가락이 재는 값이라 모바일에서만 준다
                    (§7 의 하한이 아니라 이 목록에서 고른 값이다 · #883).

                    **`lg` 에서는 걷는다.** 고정된 레일이 뷰포트보다 길면 아래쪽 조문에
                    영영 손이 닿지 않는데, 44 를 열넷에 곱하면 레일이 734px 이라 **가용
                    높이가 734 미만인 창에서 꼬리가 잘린다** — 1440×700 실측에서 마지막
                    두 조(73px)가 접힘 아래였다.

                    걷고 위아래 여백도 8 → 6 으로 내리면 줄 높이가 34 이고, 레일이
                    처리방침 594 · 약관(15조) 629 이다(1440 실측). 헤더 64 를 더한
                    658 · 693 이 이 배치가 요구하는 최소 창 높이다.

                    포인터 타깃 34 는 WCAG 2.5.8 의 24 를 넘는다.
                  */}
                  <a
                    href={`#article-${article.no}`}
                    className={cn(
                      'text-body-2 text-fg-muted hover:bg-band hover:text-fg focus-visible:ring-brand-500 flex min-h-11 items-center py-2 break-keep transition-colors focus-visible:ring-2 focus-visible:outline-none lg:min-h-0 lg:py-1.5',
                      INSET_CLASS.card,
                    )}
                  >
                    {articleLabel(article.no)} {article.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Surface>
      </SurfaceStack>

      {/*
        ③ 본문 + 개정 이력 — 우측 열 둘째 행. 위 여백은 모바일 8, 그 위로는 0
        (앞 스택의 아래 24 가 카드 간격이다).
      */}
      <SurfaceStack className="rail-detail-main pt-2 md:pt-0 lg:pl-3">
        <Surface>
          {/*
            조문 사이 구분선. 규약이 조문이 아니라 **담는 곳**에 있다 — `SurfaceList` 의
            `[&>li+li]` 와 같은 판단이다. 조문이 스스로 `border-b` 를 그으면 마지막 조문이
            자기가 마지막임을 알아야 하고, 그때부터 조문 수를 아는 호출자만 문서를 그릴 수 있다.
          */}
          <div className="[&>section+section]:border-border [&>section+section]:border-t">
            {doc.articles.map((article) => (
              <section
                key={article.no}
                className={cn('flex flex-col gap-2 py-5', INSET_CLASS.card)}
              >
                {/*
                  `scroll-mt-*` 이 없으면 목차에서 뛰었을 때 제목이 고정 헤더 뒤로 들어간다.
                */}
                <h2
                  id={`article-${article.no}`}
                  className="text-body-1 text-fg scroll-mt-20 font-semibold"
                >
                  {articleLabel(article.no)}({article.title})
                </h2>
                {article.blocks.map((block, index) => (
                  <BlockView key={index} block={block} />
                ))}
              </section>
            ))}
          </div>
        </Surface>

        {/*
          조작할 수 없는 정보라 목록 항목이 아니라 정의 목록이다 — 마이페이지의 버전 줄과
          같은 판단이다 (`account-section.tsx` D6).

          **제목은 조문과 같은 body-1 이다.** 개정 이력은 본문에 딸린 꼬리인데 §4 의 섹션
          제목(28)을 주면 제1조보다 크게 외친다.
        */}
        <Surface>
          <section className={cn('flex flex-col gap-2 py-5', INSET_CLASS.card)}>
            <h2 className="text-body-1 text-fg font-semibold">{historyLabel}</h2>
            <dl className="flex flex-col gap-1">
              {doc.history.map((revision) => (
                <div key={revision.version} className="text-caption text-fg-muted flex gap-3">
                  <dt className="shrink-0 font-medium">
                    {revision.version} · {revision.effectiveDate}
                  </dt>
                  <dd>{revision.summary}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Surface>
      </SurfaceStack>
    </div>
  )
}
