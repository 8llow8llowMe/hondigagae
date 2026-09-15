import type { Block, LegalDocument } from '@/lib/legal/types'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
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
 */

/** 표는 좁은 화면에서 자기 스크롤러를 갖는다 — 그러지 않으면 페이지가 통째로 넘친다 */
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
    <div className="overflow-x-auto">
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
    <article className={cn('flex flex-col gap-8 py-8 md:py-10', INSET_CLASS.main)}>
      <header className="flex flex-col gap-2">
        <h1 className="text-title-1 text-fg font-bold">{doc.title}</h1>
        <p className="text-body-2 text-fg-muted">
          {effectiveDateLabel} {doc.effectiveDate}
        </p>
      </header>

      {/*
        **목차를 `nav` 로 감싼다.** 조문이 열다섯이라 스크린리더 사용자가 본문에 닿기
        전에 링크 열다섯 개를 듣게 된다 — 랜드마크가 있으면 건너뛸 수 있다.
      */}
      <nav aria-label={tocLabel} className="flex flex-col gap-2">
        <h2 className="text-body-2 text-fg-muted font-semibold">{tocLabel}</h2>
        <ol className="flex flex-col gap-1">
          {doc.articles.map((article) => (
            <li key={article.no}>
              <a
                href={`#article-${article.no}`}
                className="text-body-2 text-fg-muted hover:text-fg focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none"
              >
                {articleLabel(article.no)} {article.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-6">
        {doc.articles.map((article) => (
          <section key={article.no} className="flex flex-col gap-2">
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

      {/*
        조작할 수 없는 정보라 목록 항목이 아니라 정의 목록이다 — 마이페이지의 버전 줄과
        같은 판단이다 (`account-section.tsx` D6).
      */}
      <section className="border-border flex flex-col gap-2 border-t pt-6">
        <h2 className="text-body-2 text-fg-muted font-semibold">{historyLabel}</h2>
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
    </article>
  )
}
