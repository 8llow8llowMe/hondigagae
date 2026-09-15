import { describe, expect, it } from 'vitest'

import { LEGAL_DOCUMENTS } from '@/lib/legal'

/**
 * 법률 문서의 **구조**를 지킨다 — 이슈 #610.
 *
 * 내용이 맞는지는 사람이 읽어야 하지만, 조 번호가 끊기거나 표의 행 길이가 어긋나는 것은
 * 기계가 잡을 수 있다. **개정할 때 한 조를 빠뜨리는 것이 가장 흔한 사고다.**
 */
describe('법률 문서 구조 (#610)', () => {
  /*
    **문서가 0개여도 이 파일에 테스트가 하나는 있어야 한다.** 아래 단언은 전부
    `LEGAL_DOCUMENTS` 순회 안에 있어서, 배열이 비면 실행 가능한 테스트가 없는 파일이
    된다.
  */
  it('검증 대상 목록이 배열이다', () => {
    expect(Array.isArray(LEGAL_DOCUMENTS)).toBe(true)
  })

  for (const doc of LEGAL_DOCUMENTS) {
    describe(doc.title, () => {
      it('조 번호가 1부터 연속이다', () => {
        expect(doc.articles.map((article) => article.no)).toEqual(
          doc.articles.map((_, index) => index + 1),
        )
      })

      it('표의 모든 행 길이가 머리글 수와 같다', () => {
        for (const article of doc.articles) {
          for (const block of article.blocks) {
            if (block.kind !== 'table') continue

            for (const row of block.rows) {
              expect(row, `제${article.no}조 표의 행`).toHaveLength(block.headers.length)
            }
          }
        }
      })

      it('시행일이 YYYY-MM-DD 형식이다', () => {
        expect(doc.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })

      /* 이력에 현재 버전이 없으면 화면이 "지금 무엇을 보고 있는지" 를 말하지 못한다 */
      it('개정 이력에 현재 버전이 있다', () => {
        expect(doc.history.map((revision) => revision.version)).toContain(doc.version)
      })

      it('빈 조문이 없다', () => {
        for (const article of doc.articles) {
          expect(article.blocks.length, `제${article.no}조`).toBeGreaterThan(0)
        }
      })
    })
  }
})
