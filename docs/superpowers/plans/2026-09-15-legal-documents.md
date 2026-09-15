# 이용약관·개인정보 처리방침 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이용약관과 개인정보 처리방침을 구조화 상수로 작성하고 `/terms` · `/privacy` 정적 페이지로 공개한 뒤, 푸터와 마이페이지에서 도달하게 한다.

**Architecture:** 문서 본문을 마크다운이 아니라 조·항 트리 상수(`src/lib/legal/*`)로 둔다. 공용 서버 컴포넌트가 그 트리를 순회해 목차·`#article-N` 앵커·표·개정 이력을 그린다. 본문(합니다체)과 화면 문구(해요체)를 디렉터리로 갈라 기존 톤 테스트가 경계를 강제하게 한다.

**Tech Stack:** Next.js 16 App Router (서버 컴포넌트), TypeScript, Tailwind v4, vitest (node 환경 + `renderToStaticMarkup`), Playwright

**Spec:** `docs/superpowers/specs/2026-09-15-legal-documents-design.md`

**Issue:** #610 (백엔드 선행 #607 · #608 · #609)

## Global Constraints

- **새 런타임 의존성을 추가하지 않는다.** 마크다운 파서도 `@tailwindcss/typography` 도 넣지 않는다.
- **`dangerouslySetInnerHTML` 을 쓰지 않는다.**
- 모든 파일은 **UTF-8 (no BOM)**.
- 테스트 파일 확장자는 **`.ts`** 다. `vitest.config.mts` 의 `include` 가 `src/**/*.test.ts`·`app/**/*.test.ts` 라 `.tsx` 테스트는 **실행되지 않는다.** 컴포넌트는 `createElement` 로 렌더한다.
- vitest 환경은 **node** 다. jsdom·testing-library 가 없다. 단언은 `renderToStaticMarkup` 결과 문자열에 대해 한다.
- **`src/lib/messages/` 안의 문구는 해요체다.** `message-tone.test.ts` 가 그 디렉터리의 `.ts` 파일을 훑으며 `'…습니다'` · `'…입니다'` 리터럴을 잡는다. **약관 본문은 이 디렉터리에 두지 않는다.**
- **약관·처리방침 본문은 합니다체다.** `src/lib/legal/` 에 둔다 — 톤 테스트 대상 밖이다.
- 좌우 인셋은 문자열을 새로 적지 않고 `INSET_CLASS`(`src/lib/ui/inset.ts`)를 참조한다.
- 커밋 prefix 는 `[FE]`, 제목에 `(#610)` 을 단다.
- 작업 트리를 다른 세션과 공유한다. **`git add -A` · `git add .` · `git stash` 를 쓰지 않는다** — 경로를 하나씩 적어 스테이징한다.
- **커밋 전에 `pnpm format:check` 를 돌리고, 이 태스크가 만들거나 고친 파일이 걸리면 `prettier --write <그 경로들>` 로 맞춘다.** 이 계획의 코드 블록은 prettier 포맷이 아니다 (긴 한국어 배열 리터럴이 100자 줄바꿈 규칙과 어긋난다). `pnpm verify` 에는 `format:check` 가 없지만 **`.githooks/pre-push` 와 CI 가 `format:check` 를 먼저 돌리므로**, 맞추지 않으면 푸시가 막힌다. **prettier 는 문자열 리터럴 *내용* 을 바꾸지 않는다** — 줄바꿈만 다시 잡으므로 법률 본문은 그대로다. 전사 정확성은 "문자열 안의 글자" 이지 "줄바꿈 위치" 가 아니다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `src/lib/legal/types.ts` | `Block` · `Article` · `Revision` · `LegalDocument` 타입 |
| `src/lib/legal/contact.ts` | 개인정보 보호책임자 성명·연락처 (배포 게이트) |
| `src/lib/legal/terms-of-service.ts` | 이용약관 본문 15개 조 |
| `src/lib/legal/privacy-policy.ts` | 처리방침 본문 14개 조 (법정 12 + AI + 위치) |
| `src/lib/legal/links.ts` | `/terms` · `/privacy` 링크 목록 — 푸터와 마이페이지가 함께 쓴다 |
| `src/lib/legal/index.ts` | `LEGAL_DOCUMENTS` 배열 (구조 테스트가 순회한다) |
| `src/lib/legal/legal.test.ts` | 구조 무결성 + 법정 기재사항 + 연락처 게이트 |
| `src/lib/messages/legal.ts` | 화면 문구 (해요체) |
| `src/features/legal/legal-document-view.tsx` | 공용 렌더러 |
| `src/features/legal/legal-document-view.test.ts` | 렌더 단언 |
| `app/(main)/terms/page.tsx` · `app/(main)/privacy/page.tsx` | 라우트 |
| `e2e/legal-documents.spec.ts` | 로그아웃 접근 + 푸터 도달 |

**수정:** `src/lib/messages/index.ts` · `src/lib/messages/footer.ts` · `src/features/nav/site-footer.tsx` · `src/features/nav/site-footer.test.ts` · `src/features/member/account-section.tsx` · `src/features/member/my-page.test.ts`

**확인 완료 — 라우트 보호 설정은 건드릴 필요가 없다.** `frontend/proxy.ts:19` 의 `PROTECTED_PATHS` 는 `['/mypage', '/pets', '/plans', '/ai-plans', '/favorites']` 다. `/terms` · `/privacy` 는 여기 없으므로 **기본값이 공개**이고, `app/(main)/layout.tsx` 는 `readSession()` 이 `null` 인 경우를 이미 다룬다.

---

## Task 1: 문서 타입과 구조 무결성 테스트

**Files:**
- Create: `frontend/src/lib/legal/types.ts`
- Create: `frontend/src/lib/legal/index.ts`
- Test: `frontend/src/lib/legal/legal.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `Block` · `Article` · `Revision` · `LegalDocument` 타입, `LEGAL_DOCUMENTS: readonly LegalDocument[]`

- [ ] **Step 1: 타입을 쓴다**

`frontend/src/lib/legal/types.ts`:

```ts
/**
 * 약관·개인정보 처리방침의 **본문 구조**.
 *
 * **마크다운이 아니라 조·항 트리다.** 약관은 산문이 아니라 번호가 붙은 조문 트리라
 * 배열이 실제 구조와 일치한다 — 목차·`#article-N` 앵커·누락 검증이 순회로 따라온다.
 * 마크다운 파서를 쓰면 런타임 의존성, `dangerouslySetInnerHTML`, 그리고
 * `@tailwindcss/typography` 가 없어 파서 출력에 스타일이 안 먹는 문제가 함께 온다.
 *
 * **이 디렉터리의 문구는 합니다체다.** 법률문서의 어미이고, 화면 문구(해요체)는
 * `src/lib/messages/legal.ts` 에 따로 있다 — `message-tone.test.ts` 가 그 디렉터리만
 * 훑으므로 경계가 테스트로 강제된다.
 */

/** 조문 안의 한 덩어리 */
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | {
      kind: 'table'
      headers: readonly string[]
      /** 각 행의 길이는 `headers` 와 같아야 한다 — `legal.test.ts` 가 감시한다 */
      rows: readonly (readonly string[])[]
    }

export type Article = {
  /** 조 번호. **1부터 연속이어야 한다** — 개정하다 한 조를 빠뜨리는 사고를 테스트가 잡는다 */
  no: number
  title: string
  blocks: readonly Block[]
}

/** 개정 한 줄. 최초 제정도 여기 남긴다 */
export type Revision = {
  version: string
  /** YYYY-MM-DD */
  effectiveDate: string
  summary: string
}

export type LegalDocument = {
  id: 'terms' | 'privacy'
  title: string
  version: string
  /** YYYY-MM-DD. **미래 날짜를 둘 수 있다** — 사전 공지 기간을 두고 먼저 배포하기 위해서다 */
  effectiveDate: string
  articles: readonly Article[]
  /** 최신이 앞 */
  history: readonly Revision[]
}
```

- [ ] **Step 2: 실패하는 구조 테스트를 쓴다**

`frontend/src/lib/legal/legal.test.ts`:

```ts
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
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/lib/legal/legal.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/legal"`

- [ ] **Step 4: 빈 배열로 배럴을 만든다**

`frontend/src/lib/legal/index.ts`:

```ts
import type { LegalDocument } from '@/lib/legal/types'

/**
 * 구조 테스트가 순회하는 목록. **문서를 추가하면 여기에 넣는다** — 넣지 않으면
 * 구조 검증을 받지 않는 문서가 생긴다.
 */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = []
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/lib/legal/legal.test.ts`
Expected: PASS — 1개 (`검증 대상 목록이 배열이다`). 문서별 단언은 배열이 비어 아직 돌지 않고, Task 2·3 부터 실제로 돈다

- [ ] **Step 6: 커밋**

```bash
cd frontend
git add src/lib/legal/types.ts src/lib/legal/index.ts src/lib/legal/legal.test.ts
git commit -m "[FE] feat: 법률 문서 구조 타입과 무결성 테스트를 둔다 (#610)"
```

---

## Task 2: 이용약관 본문

**Files:**
- Create: `frontend/src/lib/legal/terms-of-service.ts`
- Modify: `frontend/src/lib/legal/index.ts`
- Test: `frontend/src/lib/legal/legal.test.ts` (Task 1 의 테스트가 자동으로 이 문서를 검사한다)

**Interfaces:**
- Consumes: `LegalDocument` · `Article` · `Block` (Task 1)
- Produces: `termsOfService: LegalDocument`

- [ ] **Step 1: 약관 본문을 쓴다**

`frontend/src/lib/legal/terms-of-service.ts`:

```ts
import type { LegalDocument } from '@/lib/legal/types'

/**
 * 이용약관 — 이슈 #610.
 *
 * **제10조와 제12조가 이 서비스의 실제 리스크다.**
 *  - 제10조: 동반 가능 여부·운영시간은 공공데이터 스냅샷이고 바뀐다. 푸터
 *    `disclaimer` 가 이미 말하는 것의 법적 근거다.
 *  - 제12조: 산책 위험도는 **추정 노면온도·열지수**다. 이것을 믿고 나갔다가 반려견이
 *    다치는 상황이 물리적으로 가능하다. 면책이 형식적이면 안 된다.
 *
 * **어미는 합니다체다** (해요체가 아니다) — 법률문서의 어미이고, 이 디렉터리는
 * `message-tone.test.ts` 대상 밖이다.
 *
 * 개정할 때는 `version` · `effectiveDate` · `history` 를 함께 고친다. 제3조가 사전
 * 공지 기간을 스스로 규정하므로, **시행일을 미래로 둔 채 먼저 배포**할 수 있다.
 */
export const termsOfService: LegalDocument = {
  id: 'terms',
  title: '이용약관',
  version: '1.0',
  effectiveDate: '2026-09-15',
  articles: [
    {
      no: 1,
      title: '목적',
      blocks: [
        {
          kind: 'text',
          text: '이 약관은 혼디가개(이하 "서비스")가 제공하는 반려견 동반 여행 정보 서비스의 이용조건과 절차, 서비스 운영자와 회원의 권리·의무 및 책임사항을 정함을 목적으로 합니다.',
        },
      ],
    },
    {
      no: 2,
      title: '정의',
      blocks: [
        { kind: 'text', text: '이 약관에서 사용하는 용어의 뜻은 다음과 같습니다.' },
        {
          kind: 'list',
          items: [
            '"서비스"란 반려견 동반 가능 장소 탐색, 여행 일정 설계, 여행 적합도 및 산책 안전 정보 제공 등 운영자가 제공하는 일체의 서비스를 말합니다.',
            '"회원"이란 이 약관에 동의하고 서비스 이용계약을 체결한 사람을 말합니다.',
            '"반려견 프로필"이란 회원이 등록한 반려견의 견종, 크기, 활동 성향, 환경 민감도 등의 정보를 말합니다.',
            '"AI 제안"이란 회원이 입력한 조건과 반려견 프로필을 바탕으로 서비스가 자동으로 생성한 여행 일정 초안을 말합니다.',
          ],
        },
      ],
    },
    {
      no: 3,
      title: '약관의 효력과 변경',
      blocks: [
        {
          kind: 'list',
          items: [
            '이 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.',
            '운영자는 관련 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있습니다.',
            '약관을 개정하는 경우 적용일자와 개정 사유를 밝혀 적용일자 7일 전부터 공지합니다. 다만 회원에게 불리한 내용으로 개정하는 경우에는 적용일자 30일 전부터 공지합니다.',
            '회원이 적용일자까지 거부 의사를 표시하지 않으면 개정에 동의한 것으로 봅니다. 동의하지 않는 회원은 이용계약을 해지할 수 있습니다.',
          ],
        },
      ],
    },
    {
      no: 4,
      title: '회원가입과 이용계약의 성립',
      blocks: [
        {
          kind: 'list',
          items: [
            '이용계약은 가입 신청자가 이 약관과 개인정보 처리방침에 동의하고 운영자가 이를 승낙함으로써 성립합니다.',
            '서비스는 이메일 인증을 통한 가입과 카카오·네이버 계정을 통한 가입을 제공합니다.',
            '만 14세 미만인 사람은 회원으로 가입할 수 없습니다.',
          ],
        },
        { kind: 'text', text: '운영자는 다음에 해당하는 신청에 대하여 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.' },
        {
          kind: 'list',
          items: [
            '타인의 정보를 이용하여 신청한 경우',
            '허위 정보를 기재한 경우',
            '이전에 이 약관 위반으로 이용계약이 해지된 이력이 있는 경우',
          ],
        },
      ],
    },
    {
      no: 5,
      title: '회원 탈퇴와 자격 상실',
      blocks: [
        {
          kind: 'list',
          items: [
            '회원은 언제든지 서비스 내 탈퇴 기능으로 이용계약을 해지할 수 있습니다.',
            '탈퇴하면 회원이 등록한 반려견 프로필과 여행 일정은 삭제되며, 삭제된 정보는 복구되지 않습니다.',
            '운영자는 부정 이용을 막기 위하여 탈퇴한 회원의 재가입을 제한할 수 있습니다. 이때 보관하는 정보의 항목과 기간은 개인정보 처리방침에 따릅니다.',
          ],
        },
      ],
    },
    {
      no: 6,
      title: '서비스의 제공',
      blocks: [
        { kind: 'text', text: '운영자는 다음의 서비스를 제공합니다.' },
        {
          kind: 'list',
          items: [
            '반려견 동반 가능 장소 탐색과 상세 정보 제공',
            '반려견 프로필 관리',
            '여행 일정 관리',
            '날씨·동반조건·혼잡도를 반영한 여행 적합도와 산책 안전 정보 제공',
            'AI 여행 일정 제안',
            '현재 위치 기준 동물병원·동물약국 정보 제공',
          ],
        },
        { kind: 'text', text: '서비스는 연중무휴 24시간 제공을 원칙으로 합니다.' },
      ],
    },
    {
      no: 7,
      title: '서비스의 변경과 중단',
      blocks: [
        {
          kind: 'list',
          items: [
            '운영자는 서비스의 내용을 변경하거나 제공을 중단할 수 있습니다.',
            '설비 점검이나 교체, 통신 두절, 천재지변 등의 사유가 있는 경우 서비스 제공을 일시 중단할 수 있습니다.',
            '서비스를 종료하는 경우 종료일 30일 전부터 공지합니다.',
          ],
        },
      ],
    },
    {
      no: 8,
      title: '회원의 의무',
      blocks: [
        { kind: 'text', text: '회원은 다음 행위를 하여서는 안 됩니다.' },
        {
          kind: 'list',
          items: [
            '타인의 정보를 도용하는 행위',
            '서비스의 운영을 방해하는 행위',
            '자동화된 수단을 이용하여 대량으로 조회하는 행위',
            '서비스가 제공하는 정보를 무단으로 복제하거나 배포하는 행위',
          ],
        },
        {
          kind: 'text',
          text: '회원은 자신의 계정 정보를 관리할 책임이 있으며, 이를 제3자가 이용하게 하여서는 안 됩니다.',
        },
      ],
    },
    {
      no: 9,
      title: '회원 등록 정보의 관리',
      blocks: [
        {
          kind: 'list',
          items: [
            '회원이 등록한 반려견 프로필과 여행 일정은 해당 회원만 조회·수정·삭제할 수 있습니다.',
            '운영자는 서비스 개선을 위하여 개인을 식별할 수 없도록 가공한 통계를 이용할 수 있습니다.',
          ],
        },
      ],
    },
    {
      no: 10,
      title: '정보의 정확성과 한계',
      blocks: [
        {
          kind: 'list',
          items: [
            '서비스가 제공하는 장소 정보는 한국관광공사 TourAPI, 한국문화정보원, 식품의약품안전처 등의 공공데이터를 적재한 것으로, 원천 데이터의 갱신 주기에 따라 실제와 다를 수 있습니다.',
            '반려견 동반 가능 여부, 운영시간, 입장 조건은 사업장의 사정에 따라 예고 없이 바뀔 수 있습니다. 회원은 방문 전에 해당 장소에 직접 확인하여야 합니다.',
            '운영자는 정보의 정확성을 위하여 노력하나, 원천 데이터의 오류나 변경으로 인한 결과에 대하여 책임을 지지 않습니다.',
          ],
        },
      ],
    },
    {
      no: 11,
      title: '위치정보의 이용',
      blocks: [
        {
          kind: 'list',
          items: [
            '서비스는 현재 위치 기준 동물병원·동물약국 검색 등을 위하여 회원 단말기의 위치정보를 이용할 수 있습니다.',
            '위치정보는 회원이 브라우저에서 위치 권한을 허용한 경우에만 취득하며, 해당 조회를 처리하는 목적으로만 사용하고 저장하지 않습니다.',
            '회원은 브라우저 설정에서 언제든지 위치 권한을 철회할 수 있습니다. 이 경우 위치 기반 기능의 이용이 제한될 수 있습니다.',
          ],
        },
      ],
    },
    {
      no: 12,
      title: 'AI 제안과 안전 판정의 성격',
      blocks: [
        {
          kind: 'list',
          items: [
            'AI 제안은 회원이 입력한 조건과 반려견 프로필을 바탕으로 자동 생성한 초안이며, 운영자가 특정 장소나 일정을 보증하거나 추천하는 것이 아닙니다.',
            '서비스가 제공하는 여행 적합도, 산책 위험도, 안전 시간대는 기상 정보와 공개된 산출식을 바탕으로 한 추정값입니다. 특히 노면 온도는 실측값이 아니라 추정치입니다.',
            '이러한 정보는 참고 자료이며 수의학적 판단을 대체하지 않습니다. 반려견의 건강 상태와 현장 상황에 대한 최종 판단은 보호자에게 있습니다.',
            '회원은 반려견의 상태를 직접 관찰하여야 하며, 필요한 경우 수의사의 진료를 받아야 합니다.',
          ],
        },
      ],
    },
    {
      no: 13,
      title: '지식재산권과 공공데이터의 출처',
      blocks: [
        {
          kind: 'list',
          items: [
            '서비스가 제작한 화면 구성, 편집물, 표장에 대한 권리는 운영자에게 있습니다.',
            '서비스가 이용하는 공공데이터의 출처는 화면에 표기하며, 각 데이터의 이용조건은 제공기관의 정책을 따릅니다.',
            '회원이 등록한 반려견 프로필과 여행 일정에 대한 권리는 해당 회원에게 있습니다.',
          ],
        },
      ],
    },
    {
      no: 14,
      title: '손해배상과 면책',
      blocks: [
        {
          kind: 'list',
          items: [
            '운영자는 천재지변, 회원의 귀책사유, 제3자의 고의적 행위로 인한 손해에 대하여 책임을 지지 않습니다.',
            '운영자는 제10조와 제12조에 따른 정보의 한계로 인하여 발생한 손해에 대하여, 운영자의 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.',
            '운영자는 회원 간 또는 회원과 제3자 사이에 서비스를 매개로 발생한 분쟁에 관여하지 않습니다.',
          ],
        },
      ],
    },
    {
      no: 15,
      title: '분쟁 해결과 관할',
      blocks: [
        {
          kind: 'list',
          items: [
            '운영자와 회원은 서비스 이용과 관련하여 발생한 분쟁을 원만히 해결하기 위하여 노력합니다.',
            '서비스 이용과 관련한 분쟁에는 대한민국 법을 적용합니다.',
            '소송이 필요한 경우 민사소송법에 따른 관할 법원에 제기합니다.',
          ],
        },
      ],
    },
  ],
  history: [{ version: '1.0', effectiveDate: '2026-09-15', summary: '최초 제정' }],
}
```

- [ ] **Step 2: 배럴에 등록한다**

`frontend/src/lib/legal/index.ts` 를 통째로 바꾼다:

```ts
import { termsOfService } from '@/lib/legal/terms-of-service'
import type { LegalDocument } from '@/lib/legal/types'

/**
 * 구조 테스트가 순회하는 목록. **문서를 추가하면 여기에 넣는다** — 넣지 않으면
 * 구조 검증을 받지 않는 문서가 생긴다.
 */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [termsOfService]
```

- [ ] **Step 3: 구조 테스트를 돌린다**

Run: `cd frontend && pnpm vitest run src/lib/legal/legal.test.ts`
Expected: PASS — `이용약관` describe 안에서 조 번호 1~15 연속, 빈 조문 없음, 시행일 형식, 이력에 1.0 이 모두 통과

- [ ] **Step 4: 커밋**

```bash
cd frontend
git add src/lib/legal/terms-of-service.ts src/lib/legal/index.ts
git commit -m "[FE] feat: 이용약관 본문 15개 조를 쓴다 (#610)"
```

---

## Task 3: 개인정보 처리방침 본문과 보호책임자 게이트

**Files:**
- Create: `frontend/src/lib/legal/contact.ts`
- Create: `frontend/src/lib/legal/privacy-policy.ts`
- Modify: `frontend/src/lib/legal/index.ts`
- Modify: `frontend/src/lib/legal/legal.test.ts`

**Interfaces:**
- Consumes: `LegalDocument` (Task 1)
- Produces: `privacyPolicy: LegalDocument`, `LEGAL_CONTACT: { officerName: string; email: string }`

> **보호책임자 성명은 확정되었다** — `최성호`. 이 값은
> 사람이 정하는 값이라 자동으로 채울 수 없고, 비면 Step 1 의 테스트가 실패해
> 머지되지 않는다.

- [ ] **Step 1: 보호책임자 게이트 테스트를 먼저 쓴다**

`frontend/src/lib/legal/legal.test.ts` 에 더한다. **`import` 는 파일 머리의 기존 import 들과 같은 자리에 넣고**(경로 알파벳 순서), `describe` 블록만 파일 끝에 붙인다:

```ts
import { LEGAL_CONTACT } from '@/lib/legal/contact'

/**
 * **코드가 잡을 수 없는 값을 빌드가 잡게 만든다.**
 *
 * 보호책임자 성명·연락처는 사람이 정하는 값이라 자동으로 채울 수 없다. 그렇다고
 * 주석에 "나중에 채울 것" 이라고 적어 두면 반드시 그대로 배포된다 — 이 저장소가
 * 반복해 확인한 실패 방식이다. 테스트가 빈 값에서 실패하면 채우지 않고는 머지되지 않는다.
 *
 * **이메일은 서비스 도메인 주소여야 한다.** 공개 페이지라 크롤러가 그대로 수집하므로
 * 개인 메일 주소를 두면 스크래핑·스팸이 개인 메일함으로 간다.
 */
describe('개인정보 보호책임자 (#610)', () => {
  it('성명이 비어 있지 않다', () => {
    expect(LEGAL_CONTACT.officerName.trim().length).toBeGreaterThan(0)
  })

  it('연락처가 서비스 도메인 이메일이다 — 개인 메일 주소를 두지 않는다', () => {
    expect(LEGAL_CONTACT.email).toMatch(/^[^@\s]+@hondigagae\.com$/)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/lib/legal/legal.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/legal/contact"`

- [ ] **Step 3: 연락처 상수를 만든다**

`frontend/src/lib/legal/contact.ts`:

```ts
/**
 * 개인정보 보호책임자 — 개인정보 보호법 제31조·제30조 제1항 제9호의 법정 기재사항.
 *
 * **값이 비어 있으면 `legal.test.ts` 가 실패한다.** 사람이 정해야 하는 값이라
 * 자동으로 채울 수 없고, 주석으로 미뤄 두면 그대로 배포된다.
 *
 * **이메일은 서비스 도메인 주소를 쓴다.** 공개 페이지라 크롤러가 그대로 수집한다 —
 * 개인 메일 주소를 두면 스팸이 개인 메일함으로 간다.
 *
 * **전화번호는 두지 않는다.** 법정 기재사항은 "연락처" 이지 전화번호가 아니고,
 * 공개된 개인 번호는 회수할 수 없다.
 */
export const LEGAL_CONTACT = {
  officerName: '최성호',
  email: 'privacy@hondigagae.com',
} as const
```

> `officerName` 은 확정 값이다 — 사용자가 2026-09-15 에 `최성호` 로 지정했다. 값이
> 비면 테스트가 실패하므로 비운 채로 머지될 수 없다.

- [ ] **Step 4: 처리방침 본문을 쓴다**

`frontend/src/lib/legal/privacy-policy.ts`:

```ts
import { LEGAL_CONTACT } from '@/lib/legal/contact'
import type { LegalDocument } from '@/lib/legal/types'

/**
 * 개인정보 처리방침 — 이슈 #610.
 *
 * **개인정보보호위원회 표준 처리방침 양식(보호법 제30조)의 순서를 그대로 따른다.**
 * 제1조~제12조가 법정 기재사항이고 `legal.test.ts` 가 제목으로 존재를 검증한다.
 * 제13조(AI)와 제14조(위치정보)는 법정 필수는 아니나 이 서비스의 실제 처리를 말한다.
 *
 * **본문의 사실 기술은 코드 실측이다** (설계 명세 S3). 상상으로 쓰면 문서가 거짓이 된다.
 *  - 수집 항목: `types/member.ts` · `types/pet.ts` · 회원가입 세부명세
 *  - 위치 미저장: `lib/geo/current-position.ts` — 좌표는 조회 파라미터로만 흐른다
 *  - 국외 이전 1건: auth-service 의 Gmail SMTP 뿐이다
 *  - AI 자체 호스팅: ai-service 의 `OllamaLlmAdapter` — 외부 AI 사업자로 나가지 않는다
 *
 * **이 사실들이 바뀌면 문서를 먼저 고친다.** 좌표를 저장하는 기능이 생기거나 외부
 * LLM 으로 갈아타면 제3조·제5조·제13조·제14조가 즉시 거짓이 된다.
 */
export const privacyPolicy: LegalDocument = {
  id: 'privacy',
  title: '개인정보 처리방침',
  version: '1.0',
  effectiveDate: '2026-09-15',
  articles: [
    {
      no: 1,
      title: '개인정보의 처리 목적',
      blocks: [
        {
          kind: 'text',
          text: '혼디가개(이하 "서비스")는 다음의 목적으로 개인정보를 처리합니다. 처리 목적이 변경되는 경우에는 미리 동의를 받습니다.',
        },
        {
          kind: 'list',
          items: [
            '회원 가입과 관리: 본인 확인, 회원제 서비스 제공, 부정 이용 방지, 고지사항 전달',
            '서비스 제공: 반려견 특성에 맞는 장소 탐색, 여행 일정 관리, 여행 적합도와 산책 안전 정보 제공, AI 여행 일정 제안',
            '서비스 개선: 개인을 식별할 수 없도록 가공한 통계 분석',
          ],
        },
      ],
    },
    {
      no: 2,
      title: '처리하는 개인정보의 항목',
      blocks: [
        {
          kind: 'table',
          headers: ['구분', '항목', '수집 방법'],
          rows: [
            ['회원가입(필수)', '이메일, 비밀번호, 이름, 닉네임', '회원 직접 입력'],
            ['소셜 로그인(필수)', '소셜 계정 이메일, 소셜 서비스 식별자', '카카오·네이버 로그인 시 이용자 동의를 거쳐 전달받음'],
            ['프로필(선택)', '프로필 이미지', '회원 직접 등록'],
            ['반려견 프로필', '반려견 이름, 견종, 출생 연월, 크기, 체중, 활동 성향, 환경 민감도, 사진', '회원 직접 입력'],
            ['서비스 이용', '여행 일정, 저장한 장소, AI 제안 요청 조건', '서비스 이용 과정에서 생성'],
            ['위치정보', '단말기 위치 좌표', '회원이 브라우저에서 위치 권한을 허용한 경우'],
            ['자동 생성', '접속 기록, 인증 토큰 쿠키', '서비스 이용 과정에서 자동 생성'],
          ],
        },
        {
          kind: 'text',
          text: '반려견 프로필은 그 자체로 개인을 식별하지는 않으나 회원 계정과 결합하여 처리되므로, 서비스는 이를 회원의 개인정보와 같은 수준으로 보호합니다.',
        },
        {
          kind: 'text',
          text: '위치정보는 해당 조회를 처리하는 목적으로만 사용하며 저장하지 않습니다. 자세한 내용은 제14조에 있습니다.',
        },
      ],
    },
    {
      no: 3,
      title: '개인정보의 처리 및 보유 기간',
      blocks: [
        {
          kind: 'table',
          headers: ['구분', '보유 기간'],
          rows: [
            ['회원 정보', '회원 탈퇴 시까지'],
            ['반려견 프로필, 여행 일정, 저장한 장소', '회원 탈퇴 시까지'],
            ['이메일 인증 정보', '인증 완료 후 30분'],
            ['접속 기록', '3개월 (통신비밀보호법)'],
            ['탈퇴 회원의 재가입 제한을 위한 정보', '탈퇴 후 1년'],
            ['위치정보', '보유하지 않음'],
          ],
        },
        {
          kind: 'text',
          text: '재가입 제한을 위한 정보는 개인을 다시 식별할 수 없는 형태로 보관하며, 같은 계정의 재가입 여부를 판정하는 목적으로만 사용합니다.',
        },
      ],
    },
    {
      no: 4,
      title: '개인정보의 제3자 제공',
      blocks: [
        {
          kind: 'list',
          items: [
            '서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.',
            '다만 법령에 근거가 있거나 수사기관이 적법한 절차에 따라 요구하는 경우에는 제공할 수 있습니다.',
          ],
        },
        {
          kind: 'text',
          text: '지도 기능은 이용자의 브라우저가 카카오 지도 서비스에 직접 연결되는 방식으로 동작합니다. 이 과정에서 이용자의 IP 주소 등 접속 정보가 카카오에 전달될 수 있습니다. 이는 서비스가 개인정보를 제공하는 것이 아니라 이용자 브라우저와 카카오 사이의 통신이며, 해당 정보의 처리는 카카오의 방침을 따릅니다.',
        },
      ],
    },
    {
      no: 5,
      title: '개인정보 처리의 위탁',
      blocks: [
        { kind: 'text', text: '서비스는 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.' },
        {
          kind: 'table',
          headers: ['수탁자', '위탁 업무', '이전되는 국가'],
          rows: [['Google LLC', '인증코드 등 안내 메일 발송', '미국']],
        },
        {
          kind: 'text',
          text: '국외로 이전되는 항목은 수신자 이메일 주소이며, 이전 시점은 메일 발송 시, 이전 방법은 정보통신망을 통한 전송입니다. 이전받는 자는 발송 목적을 달성할 때까지 보유합니다.',
        },
        {
          kind: 'text',
          text: '회원 데이터베이스, 이미지 저장소, AI 언어모델은 서비스가 직접 운영하는 국내 인프라에서 처리하며 외부에 위탁하지 않습니다.',
        },
      ],
    },
    {
      no: 6,
      title: '개인정보의 파기',
      blocks: [
        {
          kind: 'list',
          items: [
            '보유 기간이 지났거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.',
            '전자적 파일 형태의 정보는 복구할 수 없는 방법으로 삭제하고, 종이에 출력된 정보는 분쇄하거나 소각합니다.',
            '법령에 따라 보존하여야 하는 정보는 다른 개인정보와 분리하여 보관합니다.',
          ],
        },
      ],
    },
    {
      no: 7,
      title: '정보주체와 법정대리인의 권리·의무 및 행사방법',
      blocks: [
        { kind: 'text', text: '정보주체는 언제든지 다음의 권리를 행사할 수 있습니다.' },
        {
          kind: 'list',
          items: [
            '개인정보 열람 요구',
            '오류가 있는 경우 정정 요구',
            '삭제 요구',
            '처리정지 요구',
          ],
        },
        {
          kind: 'text',
          text: '회원 정보의 열람과 수정은 서비스의 마이페이지에서 직접 할 수 있으며, 탈퇴는 마이페이지의 탈퇴 기능으로 할 수 있습니다.',
        },
        {
          kind: 'text',
          text: '그 밖의 권리 행사는 제10조의 개인정보 보호책임자에게 전자우편으로 요청할 수 있으며, 서비스는 지체 없이 조치합니다. 정보주체의 대리인이 권리를 행사하는 경우에는 위임 사실을 확인할 수 있는 서류를 제출하여야 합니다.',
        },
      ],
    },
    {
      no: 8,
      title: '개인정보의 안전성 확보조치',
      blocks: [
        {
          kind: 'list',
          items: [
            '비밀번호는 복호화할 수 없는 일방향 암호화 방식으로 저장합니다.',
            '이용자와 서비스 사이의 통신 구간은 암호화하여 전송합니다.',
            '개인정보에 접근할 수 있는 담당자를 최소한으로 제한하고 접근 권한을 관리합니다.',
            '인증에는 유효기간이 있는 토큰을 사용하며, 토큰은 스크립트로 읽을 수 없는 방식으로 보관합니다.',
          ],
        },
      ],
    },
    {
      no: 9,
      title: '개인정보 자동 수집 장치의 설치·운영 및 거부',
      blocks: [
        {
          kind: 'list',
          items: [
            '서비스는 로그인 상태를 유지하기 위하여 인증 토큰을 쿠키로 저장합니다.',
            '이 쿠키는 서비스 제공에 필수적이며, 광고나 행태정보 수집 목적으로는 사용하지 않습니다.',
            '이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있습니다. 다만 이 경우 로그인이 필요한 기능을 이용할 수 없습니다.',
          ],
        },
      ],
    },
    {
      no: 10,
      title: '개인정보 보호책임자',
      blocks: [
        {
          kind: 'table',
          headers: ['구분', '내용'],
          rows: [
            ['개인정보 보호책임자', LEGAL_CONTACT.officerName],
            ['연락처', LEGAL_CONTACT.email],
          ],
        },
        {
          kind: 'text',
          text: '정보주체는 개인정보 보호와 관련한 문의, 불만 처리, 피해 구제에 관한 사항을 개인정보 보호책임자에게 문의할 수 있으며, 서비스는 지체 없이 답변합니다.',
        },
      ],
    },
    {
      no: 11,
      title: '권익침해 구제방법',
      blocks: [
        {
          kind: 'text',
          text: '개인정보 침해로 인한 피해 구제와 상담은 다음 기관에 문의할 수 있습니다.',
        },
        {
          kind: 'table',
          headers: ['기관', '전화', '누리집'],
          rows: [
            ['개인정보 침해신고센터', '(국번없이) 118', 'privacy.kisa.or.kr'],
            ['개인정보 분쟁조정위원회', '1833-6972', 'kopico.go.kr'],
            ['대검찰청 사이버수사과', '(국번없이) 1301', 'spo.go.kr'],
            ['경찰청 사이버수사국', '(국번없이) 182', 'ecrm.police.go.kr'],
          ],
        },
        {
          kind: 'text',
          text: '개인정보 보호법 제35조 등에 따른 요구에 대한 처분에 불복하는 경우에는 행정심판법에 따라 행정심판을 청구할 수 있습니다.',
        },
      ],
    },
    {
      no: 12,
      title: '개인정보 처리방침의 변경',
      blocks: [
        {
          kind: 'list',
          items: [
            '이 처리방침은 시행일부터 적용합니다.',
            '내용이 변경되는 경우 시행 7일 전부터 공지하며, 이용자의 권리에 중요한 변경이 있는 경우에는 30일 전부터 공지합니다.',
            '이전의 처리방침은 이 문서 아래의 개정 이력에서 확인할 수 있습니다.',
          ],
        },
      ],
    },
    {
      no: 13,
      title: '인공지능 기술의 이용',
      blocks: [
        {
          kind: 'list',
          items: [
            '서비스는 회원이 입력한 여행 조건과 반려견 프로필을 바탕으로 여행 일정 초안을 생성하는 데 인공지능 언어모델을 이용합니다.',
            '이 언어모델은 서비스가 직접 운영하는 인프라에서 구동되며, 회원이 입력한 정보는 외부 인공지능 사업자에게 전송되지 않습니다.',
            'AI 제안은 회원에게 법적 효과나 그에 준하는 영향을 미치는 결정이 아니며, 어떤 일정을 선택할지는 회원이 정합니다.',
          ],
        },
      ],
    },
    {
      no: 14,
      title: '위치정보의 처리',
      blocks: [
        {
          kind: 'list',
          items: [
            '서비스는 현재 위치 기준 동물병원·동물약국 검색 등 위치 기반 기능을 위하여 회원 단말기의 위치 좌표를 이용합니다.',
            '위치 좌표는 회원이 브라우저에서 위치 권한을 허용한 경우에만 취득합니다.',
            '취득한 좌표는 해당 조회를 처리하는 목적으로만 사용하며 서비스에 저장하지 않습니다.',
            '회원은 브라우저 설정에서 언제든지 위치 권한을 철회할 수 있습니다.',
          ],
        },
      ],
    },
  ],
  history: [{ version: '1.0', effectiveDate: '2026-09-15', summary: '최초 제정' }],
}
```

- [ ] **Step 5: 법정 기재사항 누락 테스트를 쓴다**

`frontend/src/lib/legal/legal.test.ts` 에 더한다. Step 1 과 같다 — **`import` 는 파일 머리에**, `REQUIRED_SECTIONS` 상수와 `describe` 는 파일 끝에 붙인다:

```ts
import { privacyPolicy } from '@/lib/legal/privacy-policy'

/**
 * 개인정보보호위원회 **표준 처리방침 양식(보호법 제30조)** 의 12개 절.
 *
 * 한 절을 지우거나 제목을 바꾸면 여기서 걸린다. **개정하면서 절을 통째로 날리는 것이
 * 실제로 일어나는 사고이고**, 그 결과가 법정 기재사항 누락이다.
 */
const REQUIRED_SECTIONS = [
  '개인정보의 처리 목적',
  '개인정보의 처리 및 보유 기간',
  '처리하는 개인정보의 항목',
  '개인정보의 제3자 제공',
  '개인정보 처리의 위탁',
  '개인정보의 파기',
  '정보주체와 법정대리인의 권리·의무 및 행사방법',
  '개인정보의 안전성 확보조치',
  '개인정보 자동 수집 장치의 설치·운영 및 거부',
  '개인정보 보호책임자',
  '권익침해 구제방법',
  '개인정보 처리방침의 변경',
] as const

describe('개인정보 처리방침 — 법정 기재사항 (#610)', () => {
  const titles = privacyPolicy.articles.map((article) => article.title)

  for (const section of REQUIRED_SECTIONS) {
    it(`"${section}" 절이 있다`, () => {
      expect(titles).toContain(section)
    })
  }

  /* 법정 12개 절이 앞에 오고 그 뒤에 추가 절이 온다 — 심사자가 순서대로 훑는다 */
  it('법정 12개 절이 표준 양식 순서대로 제1조부터 놓인다', () => {
    expect(titles.slice(0, REQUIRED_SECTIONS.length)).toEqual([...REQUIRED_SECTIONS])
  })
})
```

- [ ] **Step 6: 배럴에 등록한다**

`frontend/src/lib/legal/index.ts` 를 통째로 바꾼다:

```ts
import { privacyPolicy } from '@/lib/legal/privacy-policy'
import { termsOfService } from '@/lib/legal/terms-of-service'
import type { LegalDocument } from '@/lib/legal/types'

/**
 * 구조 테스트가 순회하는 목록. **문서를 추가하면 여기에 넣는다** — 넣지 않으면
 * 구조 검증을 받지 않는 문서가 생긴다.
 */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [termsOfService, privacyPolicy]
```

- [ ] **Step 7: 테스트를 돌린다**

Run: `cd frontend && pnpm vitest run src/lib/legal/legal.test.ts`
Expected: PASS — 두 문서의 구조 검증 + 법정 12개 절 + 보호책임자 게이트

- [ ] **Step 8: 커밋**

```bash
cd frontend
git add src/lib/legal/contact.ts src/lib/legal/privacy-policy.ts src/lib/legal/index.ts src/lib/legal/legal.test.ts
git commit -m "[FE] feat: 개인정보 처리방침 본문과 법정 기재사항 검증을 둔다 (#610)"
```

---

## Task 4: 화면 문구와 링크 목록

**Files:**
- Create: `frontend/src/lib/messages/legal.ts`
- Create: `frontend/src/lib/legal/links.ts`
- Modify: `frontend/src/lib/messages/index.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `messages.legal` (`termsTitle` · `termsDescription` · `privacyTitle` · `privacyDescription` · `tocLabel` · `effectiveDateLabel` · `historyLabel` · `articleLabel(no: number): string`), `LEGAL_LINKS: readonly { href: string; label: string }[]`

- [ ] **Step 1: 화면 문구를 쓴다 — 해요체다**

`frontend/src/lib/messages/legal.ts`:

```ts
/**
 * 약관·처리방침 **화면** 문구 — 이슈 #610.
 *
 * **본문은 여기 없다.** 본문은 `src/lib/legal/*` 에 있고 합니다체다 (법률문서의 어미).
 * 이 파일의 문구는 화면이 만드는 것이라 다른 화면과 같은 해요체를 쓴다 — 같은 페이지에서
 * 어미가 갈리는 것처럼 보이지만, 갈리는 단위가 **문서 본문 / 서비스가 붙이는 라벨** 로
 * 뚜렷해서 읽는 사람에게는 오히려 자연스럽다.
 *
 * **경계가 테스트로 강제된다.** `message-tone.test.ts` 는 이 디렉터리만 훑으므로,
 * 본문을 여기로 흘려 넣으면 합쇼체가 걸려 실패한다.
 */
export const legalMessages = {
  termsTitle: '이용약관',
  termsDescription: '혼디가개 서비스를 이용할 때 적용되는 약관이에요.',
  privacyTitle: '개인정보 처리방침',
  privacyDescription: '혼디가개가 어떤 정보를 받고 어떻게 다루는지 알려드려요.',
  tocLabel: '목차',
  effectiveDateLabel: '시행일',
  historyLabel: '개정 이력',
  /** `제3조` — 목차와 조문 제목이 같은 말을 쓰게 한 곳에서 만든다 */
  articleLabel: (no: number) => `제${no}조`,
} as const
```

- [ ] **Step 2: 배럴에 등록한다**

`frontend/src/lib/messages/index.ts` 에 import 한 줄과 항목 한 줄을 더한다. `simple-import-sort` 는 **모듈 경로**로 정렬하므로 `@/lib/messages/home` 줄 **다음**, `@/lib/messages/map` 줄 **앞**이다 (가져오는 이름이 아니라 경로 기준이다):

```ts
import { legalMessages } from '@/lib/messages/legal'
```

`messages` 객체에는 `footer` 다음 줄에 넣는다:

```ts
  legal: legalMessages,
```

- [ ] **Step 3: 링크 목록을 만든다**

`frontend/src/lib/legal/links.ts`:

```ts
import { messages } from '@/lib/messages'

/**
 * 약관·처리방침으로 가는 링크 — 이슈 #610.
 *
 * **푸터와 마이페이지가 같은 목록을 쓴다.** 두 곳에 따로 적으면 한쪽만 고쳐지고,
 * 라벨이 갈리면 같은 문서가 화면마다 다른 이름으로 보인다. 라벨은 문서 제목 그 자체라
 * `messages.legal` 에서 가져온다 — 여기서 다시 짓지 않는다.
 *
 * **문의는 아직 없다.** 페이지가 생기면 그때 더한다 — 없는 링크를 만들지 않는다는
 * 규칙은 그대로다 (`messages/footer.ts`).
 */
export const LEGAL_LINKS = [
  { href: '/terms', label: messages.legal.termsTitle },
  { href: '/privacy', label: messages.legal.privacyTitle },
] as const
```

- [ ] **Step 4: 톤 테스트와 타입 검사를 돌린다**

Run: `cd frontend && pnpm vitest run src/lib/messages && pnpm typecheck`
Expected: PASS — 새 문구에 합쇼체가 없고 타입이 맞는다

- [ ] **Step 5: 커밋**

```bash
cd frontend
git add src/lib/messages/legal.ts src/lib/messages/index.ts src/lib/legal/links.ts
git commit -m "[FE] feat: 약관 화면 문구와 링크 목록을 둔다 (#610)"
```

---

## Task 5: 공용 렌더러

**Files:**
- Create: `frontend/src/features/legal/legal-document-view.tsx`
- Test: `frontend/src/features/legal/legal-document-view.test.ts`

**Interfaces:**
- Consumes: `LegalDocument` · `Block` (Task 1), `termsOfService` (Task 2), `messages.legal` (Task 4), `INSET_CLASS` (`@/lib/ui/inset`), `cn` (`@/lib/utils/cn`)
- Produces: `LegalDocumentView({ doc }: { doc: LegalDocument })`

- [ ] **Step 1: 실패하는 렌더 테스트를 쓴다**

`frontend/src/features/legal/legal-document-view.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { LegalDocumentView } from '@/features/legal/legal-document-view'
import { privacyPolicy } from '@/lib/legal/privacy-policy'
import { termsOfService } from '@/lib/legal/terms-of-service'
import { messages } from '@/lib/messages'

/**
 * 약관 렌더러 — 이슈 #610.
 *
 * **상태가 없는 서버 컴포넌트라 통째로 렌더된다** (`testing-guide.md` §1).
 */
const terms = renderToStaticMarkup(createElement(LegalDocumentView, { doc: termsOfService }))
const privacy = renderToStaticMarkup(createElement(LegalDocumentView, { doc: privacyPolicy }))

describe('LegalDocumentView — 문서 머리 (#610)', () => {
  it('제목과 시행일을 낸다', () => {
    expect(terms).toContain(termsOfService.title)
    expect(terms).toContain(termsOfService.effectiveDate)
    expect(terms).toContain(messages.legal.effectiveDateLabel)
  })
})

describe('LegalDocumentView — 목차와 앵커 (#610)', () => {
  /*
    목차가 가리키는 자리가 실제로 있어야 한다. 앵커만 있고 `id` 가 없으면 눌러도
    아무 일이 일어나지 않는다 — 긴 문서에서 이것이 가장 티 안 나는 고장이다.
  */
  it('모든 조문에 목차 링크와 대응하는 id 가 있다', () => {
    for (const article of termsOfService.articles) {
      expect(terms).toContain(`href="#article-${article.no}"`)
      expect(terms).toContain(`id="article-${article.no}"`)
    }
  })

  it('목차를 nav 로 감싸 건너뛸 수 있게 한다', () => {
    expect(terms).toContain(`aria-label="${messages.legal.tocLabel}"`)
  })

  it('조문 제목이 "제N조(제목)" 형태다', () => {
    expect(terms).toContain(`${messages.legal.articleLabel(10)}(정보의 정확성과 한계)`)
  })
})

describe('LegalDocumentView — 블록 (#610)', () => {
  it('표를 <table> 로 그린다 — 처리방침의 수집 항목 표', () => {
    expect(privacy).toContain('<table')
    expect(privacy).toContain('<th')
    expect(privacy).toContain('반려견 이름, 견종, 출생 연월, 크기, 체중, 활동 성향, 환경 민감도, 사진')
  })

  /* 가로 폭이 좁으면 표가 화면을 밀어낸다 — DESIGN.md §7 이 버그로 못박은 증상이다 */
  it('표를 가로 스크롤 컨테이너에 넣는다', () => {
    expect(privacy).toContain('overflow-x-auto')
  })

  it('목록을 <ul> 로 그린다', () => {
    expect(terms).toContain('<ul')
    expect(terms).toContain('만 14세 미만인 사람은 회원으로 가입할 수 없습니다.')
  })
})

describe('LegalDocumentView — 개정 이력 (#610)', () => {
  /* 조작할 수 없는 정보라 목록 항목이 아니라 정의 목록이다 (마이페이지 버전 줄과 같은 판단) */
  it('개정 이력을 dl 로 그린다', () => {
    expect(terms).toContain(messages.legal.historyLabel)
    expect(terms).toContain('<dl')
    expect(terms).toContain('최초 제정')
  })
})

describe('LegalDocumentView — 핵심 조문이 빠지지 않는다 (#610)', () => {
  /*
    이 두 문장이 이 서비스의 실제 리스크다 — 추정값을 믿고 나갔다가 반려견이 다치는
    상황이 물리적으로 가능하다. 문구를 손대다 지우면 여기서 걸린다.
  */
  it('AI·안전 판정이 추정값이고 수의학적 판단을 대체하지 않는다고 말한다', () => {
    expect(terms).toContain('노면 온도는 실측값이 아니라 추정치입니다')
    expect(terms).toContain('수의학적 판단을 대체하지 않습니다')
  })

  it('AI 입력이 외부 사업자로 나가지 않는다고 말한다', () => {
    expect(privacy).toContain('외부 인공지능 사업자에게 전송되지 않습니다')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/features/legal`
Expected: FAIL — `Failed to resolve import "@/features/legal/legal-document-view"`

- [ ] **Step 3: 렌더러를 쓴다**

`frontend/src/features/legal/legal-document-view.tsx`:

```tsx
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
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/features/legal`
Expected: PASS — 12개 단언 전부

- [ ] **Step 5: 커밋**

```bash
cd frontend
git add src/features/legal/legal-document-view.tsx src/features/legal/legal-document-view.test.ts
git commit -m "[FE] feat: 약관 문서 공용 렌더러를 둔다 (#610)"
```

---

## Task 6: 라우트 둘

**Files:**
- Create: `frontend/app/(main)/terms/page.tsx`
- Create: `frontend/app/(main)/privacy/page.tsx`

**Interfaces:**
- Consumes: `LegalDocumentView` (Task 5), `termsOfService` (Task 2), `privacyPolicy` (Task 3), `messages.legal` (Task 4), `Canvas` (`@/components/surface`)
- Produces: `/terms` · `/privacy` 라우트

- [ ] **Step 1: 약관 라우트를 만든다**

`frontend/app/(main)/terms/page.tsx`:

```tsx
import { Canvas } from '@/components/surface'
import { LegalDocumentView } from '@/features/legal/legal-document-view'
import { termsOfService } from '@/lib/legal/terms-of-service'
import { messages } from '@/lib/messages'

/**
 * 이용약관 — 이슈 #610.
 *
 * **미로그인에서도 열려야 한다.** 약관은 가입 전에 읽는 문서다. `proxy.ts` 의
 * `PROTECTED_PATHS` 에 `/terms` 가 없으므로 기본값이 공개이고, `(main)` 레이아웃은
 * `readSession()` 이 `null` 인 경우를 이미 다룬다 — 따로 할 일이 없다.
 *
 * **데이터 조회가 없다.** 본문이 상수라 프리페치할 것도, 로딩 상태도 없다.
 */
export const metadata = {
  title: `${messages.legal.termsTitle} · 혼디가개`,
  description: messages.legal.termsDescription,
}

export default function TermsPage() {
  return (
    <Canvas as="main" id="main-content">
      <LegalDocumentView doc={termsOfService} />
    </Canvas>
  )
}
```

- [ ] **Step 2: 처리방침 라우트를 만든다**

`frontend/app/(main)/privacy/page.tsx`:

```tsx
import { Canvas } from '@/components/surface'
import { LegalDocumentView } from '@/features/legal/legal-document-view'
import { privacyPolicy } from '@/lib/legal/privacy-policy'
import { messages } from '@/lib/messages'

/**
 * 개인정보 처리방침 — 이슈 #610.
 *
 * **미로그인에서도 열려야 한다** — 약관 페이지와 같은 이유다 (`terms/page.tsx`).
 */
export const metadata = {
  title: `${messages.legal.privacyTitle} · 혼디가개`,
  description: messages.legal.privacyDescription,
}

export default function PrivacyPage() {
  return (
    <Canvas as="main" id="main-content">
      <LegalDocumentView doc={privacyPolicy} />
    </Canvas>
  )
}
```

- [ ] **Step 3: 빌드가 되는지 확인한다**

Run: `cd frontend && pnpm typecheck && pnpm build`
Expected: PASS — 빌드 출력의 라우트 목록에 `/terms` 와 `/privacy` 가 나온다. **둘 다 동적(`ƒ`)이고 그게 맞다**: `(main)/layout.tsx` 가 `readSession()` → `await cookies()` 를 부르므로 그 그룹 **전체**가 이미 동적이다. 이 두 라우트가 새로 만든 성질이 아니다. 정적으로 만들려면 `(main)` 밖으로 빼야 하는데 그러면 헤더·푸터 셸을 잃고, 푸터는 이 작업이 만드는 진입점 둘 중 하나다

- [ ] **Step 4: 커밋**

```bash
cd frontend
git add "app/(main)/terms/page.tsx" "app/(main)/privacy/page.tsx"
git commit -m "[FE] feat: /terms · /privacy 라우트를 연다 (#610)"
```

---

## Task 7: 푸터 연결

**Files:**
- Modify: `frontend/src/lib/messages/footer.ts`
- Modify: `frontend/src/features/nav/site-footer.tsx`
- Modify: `frontend/src/features/nav/site-footer.test.ts`

**Interfaces:**
- Consumes: `LEGAL_LINKS` (Task 4), `/terms` · `/privacy` 라우트 (Task 6)
- Produces: 푸터의 약관 링크 블록

- [ ] **Step 1: 푸터 문구에 라벨을 더하고 낡은 주석을 고친다**

`frontend/src/lib/messages/footer.ts` 의 **파일 머리 주석 마지막 문단**을 바꾼다.

바꾸기 전:

```ts
 * **없는 링크를 만들지 않는다.** 이용약관·개인정보처리방침·문의는 아직 없는 페이지라
 * 자리만 잡아 두면 눌러 보고 아무 일도 안 일어난다. 생기면 그때 더한다.
```

바꾼 뒤:

```ts
 * **없는 링크를 만들지 않는다.** 이용약관·개인정보 처리방침은 #610 에서 페이지가
 * 생겨 링크를 걸었다 — 목록은 `lib/legal/links.ts` 가 들고, 라벨을 여기서 다시 짓지
 * 않는다. **문의는 여전히 없는 페이지라 넣지 않는다.** 생기면 그때 더한다.
```

그리고 `footerMessages` 객체의 `disclaimer` 항목 **다음**에 한 줄을 더한다:

```ts
  /** 약관 링크 묶음의 랜드마크 이름. 링크 자체는 `lib/legal/links.ts` 가 든다 */
  legalLabel: '약관',
```

- [ ] **Step 2: 실패하는 테스트로 바꾼다**

`frontend/src/features/nav/site-footer.test.ts` 에서 아래 블록을 통째로 **교체**한다.

바꾸기 전:

```ts
  /*
    이용약관·개인정보처리방침·문의는 아직 페이지가 없다. 자리만 잡아 두면 눌러 보고
    아무 일도 일어나지 않는다 — 없는 링크를 만들지 않는다.
  */
  it('갈 곳 없는 링크를 두지 않는다', () => {
    expect(markup).not.toContain('<a ')
    expect(markup).not.toContain('href')
  })
```

바꾼 뒤:

```ts
  /*
    #610 에서 약관·처리방침 페이지가 생겨 링크를 걸었다. **규칙은 그대로다** —
    없는 링크를 만들지 않는다. 그래서 "링크가 없다" 가 아니라 "이 둘 말고는 없다" 로
    단언을 옮긴다. 문의는 여전히 페이지가 없어 들어오면 여기서 걸린다.
  */
  it('약관·처리방침 링크가 실재 라우트를 가리킨다', () => {
    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
      expect(markup).toContain(link.label)
    }
  })

  it('그 둘 말고 다른 링크를 두지 않는다 — 문의는 아직 페이지가 없다', () => {
    expect(markup.match(/<a /g)?.length).toBe(LEGAL_LINKS.length)
  })

  it('약관 링크 묶음에 랜드마크 이름을 준다', () => {
    expect(markup).toContain(`aria-label="${messages.footer.legalLabel}"`)
  })
```

import 를 파일 머리에 더한다 (`simple-import-sort` 순서상 `@/features/nav/site-footer` **다음**):

```ts
import { LEGAL_LINKS } from '@/lib/legal/links'
```

**같은 파일의 출처 개수 단언도 함께 고친다.** 새 링크의 `<li>` 가 클래스 없이 렌더되어 기존 정규식 `/<li>/g` 에 함께 잡히기 때문이다.

바꾸기 전:

```ts
  it('출처를 <ul> 로 둔다 — 한 문장으로 잇지 않는다', () => {
    expect(markup).toContain('<ul')
    expect(markup.match(/<li>/g)?.length).toBe(messages.footer.sources.length)
  })
```

바꾼 뒤:

```ts
  it('출처를 <ul> 로 둔다 — 한 문장으로 잇지 않는다', () => {
    expect(markup).toContain('<ul')

    /*
      **푸터 전체가 아니라 출처 목록만 센다.** #610 에서 약관 링크가 들어오며 푸터에
      `<li>` 가 두 종류가 됐다 — 전체를 세면 링크를 하나 더할 때마다 이 단언이 엉뚱하게
      깨진다. 출처 제목과 그 뒤 첫 `</ul>` 사이를 잘라 그 안에서만 센다.
    */
    const sourcesList = markup.split(messages.footer.sourcesLabel)[1]?.split('</ul>')[0] ?? ''

    expect(sourcesList.match(/<li>/g)?.length).toBe(messages.footer.sources.length)
  })
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/features/nav/site-footer.test.ts`
Expected: FAIL — `약관·처리방침 링크가 실재 라우트를 가리킨다` 가 `href="/terms"` 를 찾지 못한다

- [ ] **Step 4: 푸터에 링크를 단다**

`frontend/src/features/nav/site-footer.tsx` 를 세 군데 고친다.

**(a)** import 를 더한다 (`simple-import-sort` 순서상 `Wordmark` 다음, `messages` 앞):

```tsx
import Link from 'next/link'

import { LEGAL_LINKS } from '@/lib/legal/links'
```

`next/link` 는 패키지 import 라 `@/` 그룹보다 위 블록에 놓인다.

**(b)** 파일 머리 주석의 마지막 문단을 바꾼다.

바꾸기 전:

```tsx
 * **없는 링크를 만들지 않는다** — 이용약관·문의는 아직 페이지가 없다. 자리만 잡아 두면
 * 눌러 보고 아무 일도 일어나지 않는다.
```

바꾼 뒤:

```tsx
 * **없는 링크를 만들지 않는다** — 규칙은 그대로다. 이용약관·개인정보 처리방침은 #610 에서
 * 페이지가 생겨 링크를 걸었고, **문의는 여전히 페이지가 없어 넣지 않는다.**
```

**(c)** 마지막 `div`(`border-t` 블록)의 `disclaimer` 문단 **앞**에 링크 묶음을 넣는다.

바꾸기 전:

```tsx
        <div className="border-border flex flex-col gap-1 border-t pt-4">
          <p className="text-caption text-fg-muted font-medium">{messages.footer.disclaimer}</p>
```

바꾼 뒤:

```tsx
        <div className="border-border flex flex-col gap-2 border-t pt-4">
          {/*
            **링크 묶음도 목록이다** — 출처 목록과 같은 이유로 `<ul>` 로 둔다. 랜드마크
            이름을 주는 것은 스크린리더 사용자가 푸터 안에서 이 묶음을 골라 들어오기
            위해서다.
          */}
          <nav aria-label={messages.footer.legalLabel}>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-caption text-fg-muted hover:text-fg focus-visible:ring-brand-500 font-medium focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="text-caption text-fg-muted font-medium">{messages.footer.disclaimer}</p>
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/features/nav/site-footer.test.ts`
Expected: PASS — 출처 개수 단언을 포함해 전부

- [ ] **Step 6: 커밋**

```bash
cd frontend
git add src/lib/messages/footer.ts src/features/nav/site-footer.tsx src/features/nav/site-footer.test.ts
git commit -m "[FE] feat: 푸터에 약관·처리방침 링크를 건다 (#610)"
```

---

## Task 8: 마이페이지 연결

**Files:**
- Modify: `frontend/src/features/member/account-section.tsx`
- Modify: `frontend/src/features/member/my-page.test.ts`

**Interfaces:**
- Consumes: `LEGAL_LINKS` (Task 4), `/terms` · `/privacy` 라우트 (Task 6)
- Produces: 마이페이지 계정 섹션의 약관 항목 둘

- [ ] **Step 1: 실패하는 테스트로 뒤집는다**

`frontend/src/features/member/my-page.test.ts` 에서 아래 블록을 통째로 **교체**한다.

바꾸기 전:

```ts
  /**
   * 링크 대상 문서가 아직 없다 — "API 없이 진입점만 만들지 않는다" 와 같은 규칙이다 (D8-1).
   * 이 단언이 깨지면 죽은 링크를 되살린 것이다.
   */
  it('이용약관·개인정보 처리방침을 아직 렌더하지 않는다', () => {
    const markup = account('general', null)

    expect(markup).not.toContain('이용약관')
    expect(markup).not.toContain('개인정보 처리방침')
  })
```

바꾼 뒤:

```ts
  /**
   * #610 에서 문서와 페이지가 생겼다. **규칙이 바뀐 것이 아니라 전제가 채워진 것이다** —
   * "API 없이 진입점만 만들지 않는다" 는 그대로고, 이제 대상이 실재한다 (D8-1).
   */
  it('이용약관·개인정보 처리방침을 실재 라우트로 건다', () => {
    const markup = account('general', null)

    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
      expect(markup).toContain(link.label)
    }
  })

  /*
    **계정 상태와 무관하게 나온다.** 약관은 소셜 계정에도 비밀번호 계정에도, 판별
    불가(`unknown`)한 계정에도 똑같이 적용된다 — 상태로 갈리면 어떤 회원은 자기에게
    적용되는 문서에 마이페이지에서 닿지 못한다.
  */
  it('계정 상태가 unknown 이어도 약관 항목은 나온다', () => {
    const markup = account('unknown', null)

    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
    }
  })
```

import 를 파일 머리에 더한다:

```ts
import { LEGAL_LINKS } from '@/lib/legal/links'
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/features/member/my-page.test.ts`
Expected: FAIL — `href="/terms"` 를 찾지 못한다

- [ ] **Step 3: 계정 섹션에 항목을 더한다**

`frontend/src/features/member/account-section.tsx` 를 네 군데 고친다.

**(a)** import 를 더한다:

```tsx
import { LEGAL_LINKS } from '@/lib/legal/links'
```

**(b)** 파일 머리 주석의 마지막 문단을 바꾼다.

바꾸기 전:

```tsx
 * `이용약관` · `개인정보 처리방침` 은 **이번에 렌더하지 않는다.** 링크 대상 문서가
 * 아직 없다 — "API 없이 진입점만 만들지 않는다" 와 같은 규칙이다 (D8-1).
```

바꾼 뒤:

```tsx
 * `이용약관` · `개인정보 처리방침` 은 #610 에서 문서와 페이지가 생겨 **이제 렌더한다.**
 * 규칙("진입점만 먼저 만들지 않는다", D8-1)이 바뀐 것이 아니라 전제가 채워진 것이다.
 *
 * **이 둘은 계정 상태로 갈리지 않는다.** 약관은 소셜 계정에도, 비밀번호 계정에도,
 * 판별 불가한 계정에도 똑같이 적용된다 — 그래서 목록은 **항상 항목을 갖는다**.
```

**(c)** `hasItems` 를 걷는다. 약관 항목이 항상 렌더되므로 목록이 빌 수 없다.

바꾸기 전:

```tsx
  /*
    둘 다 없는 경우가 실제로 있다 — `unknown`(provider 없음 + 비밀번호 없음)이면 읽기
    항목도 이동 항목도 내지 않는다. 그때 빈 `ul` 과 그 아래 `border-t` 를 그리면 제목
    바로 밑에 허공에 선이 하나 뜬다.
  */
  const hasItems = name !== null || state !== 'unknown'

  return (
    <>
      {hasItems && (
        <SurfaceList>
```

바꾼 뒤:

```tsx
  /*
    **빈 목록이 더는 나올 수 없다** (#610). 예전에는 `unknown`(provider 없음 + 비밀번호
    없음)이면 항목이 하나도 없어 빈 `ul` 과 허공의 선이 생겼고, 그래서 `hasItems` 로
    통째로 감쌌다. 이제 약관 항목 둘이 상태와 무관하게 항상 들어와 그 경우가 사라졌다.
  */

  return (
    <>
      <SurfaceList>
```

**(d)** `SurfaceList` 를 닫기 **직전** — 비밀번호 항목 `)}` 다음 — 에 약관 항목을 넣고, 닫는 부분과 그 아래 `dl` 을 고친다.

바꾸기 전:

```tsx
          )}
        </SurfaceList>
      )}

      {/*
        조작 불가 정보 — 목록 항목이 아니라 정의 목록이다 (D6).
        **목록 밖이라 선을 스스로 든다.** `SurfaceList` 의 선은 자기 `li` 사이에만 걸린다.
      */}
      <dl
        className={cn(
          'flex min-h-14 items-center gap-3 py-3',
          hasItems && 'border-border border-t',
          INSET_CLASS.card,
        )}
      >
```

바꾼 뒤:

```tsx
          )}

          {/*
            **계정 상태로 갈리지 않는다.** 약관은 모든 회원에게 같게 적용되므로 조건 없이
            낸다 — 목록이 항상 항목을 갖는 이유이기도 하다.
          */}
          {LEGAL_LINKS.map((link) => (
            <li key={link.href} className={INSET_CLASS.card}>
              <Link
                href={link.href}
                className="focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                <span className="text-body-1 text-fg flex-1">{link.label}</span>
                <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
              </Link>
            </li>
          ))}
        </SurfaceList>

      {/*
        조작 불가 정보 — 목록 항목이 아니라 정의 목록이다 (D6).
        **목록 밖이라 선을 스스로 든다.** `SurfaceList` 의 선은 자기 `li` 사이에만 걸린다.
        목록이 항상 항목을 가지므로 선도 항상 긋는다 (#610).
      */}
      <dl className={cn('border-border flex min-h-14 items-center gap-3 border-t py-3', INSET_CLASS.card)}>
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/features/member/my-page.test.ts`
Expected: PASS

- [ ] **Step 5: 린트와 타입을 확인한다**

Run: `cd frontend && pnpm lint && pnpm typecheck`
Expected: PASS — `hasItems` 를 걷었으므로 미사용 변수 경고가 남아 있으면 안 된다

- [ ] **Step 6: 커밋**

```bash
cd frontend
git add src/features/member/account-section.tsx src/features/member/my-page.test.ts
git commit -m "[FE] feat: 마이페이지에 약관·처리방침 링크를 건다 (#610)"
```

---

## Task 9: e2e 와 전체 검증

**Files:**
- Create: `frontend/e2e/legal-documents.spec.ts`

**Interfaces:**
- Consumes: `/terms` · `/privacy` 라우트 (Task 6), 푸터 링크 (Task 7)
- Produces: 없음 (최종 검증)

- [ ] **Step 1: e2e 를 쓴다**

`frontend/e2e/legal-documents.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

/**
 * 약관·개인정보 처리방침 — 이슈 #610.
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 마크업이 아니라 **"가입하지 않은 사람이 읽을 수 있다"** 는 상태다.
 * 약관은 가입 **전에** 읽는 문서라, 보호 라우트로 새면 문서가 있으나 마나다.
 * `proxy.ts` 의 `PROTECTED_PATHS` 는 node 환경 렌더 테스트에 존재하지 않아 단위
 * 테스트로는 이 회귀를 잡을 수 없다.
 *
 * 목차 앵커도 여기서 잰다 — `scroll-mt` 와 `id` 가 실제로 맞물리는지는 브라우저만 안다.
 */
test.describe('약관 문서 — 로그아웃 상태 (#610)', () => {
  /* 가입 전 사용자를 재현한다 — 쿠키가 하나도 없는 컨텍스트다 */
  test.use({ storageState: { cookies: [], origins: [] } })

  test('로그인하지 않아도 이용약관이 열린다', async ({ page }) => {
    await page.goto('/terms')

    await expect(page).toHaveURL(/\/terms$/)
    await expect(page.getByRole('heading', { level: 1, name: '이용약관' })).toBeVisible()
  })

  test('로그인하지 않아도 개인정보 처리방침이 열린다', async ({ page }) => {
    await page.goto('/privacy')

    await expect(page).toHaveURL(/\/privacy$/)
    await expect(
      page.getByRole('heading', { level: 1, name: '개인정보 처리방침' }),
    ).toBeVisible()
  })

  test('푸터 링크로 약관에 닿는다', async ({ page }) => {
    /*
      **홈에서 출발한다.** 푸터는 `(main)` 레이아웃의 `AppShell` 이 그리므로 `(auth)`
      그룹(`/login` 등)에는 아예 없다. 홈은 `(main)` 이고, 보호 라우트가 아니며,
      지도로 뷰포트를 채우지 않는다.
    */
    await page.goto('/')

    await page.getByRole('navigation', { name: '약관' }).getByRole('link', { name: '이용약관' }).click()

    await expect(page).toHaveURL(/\/terms$/)
  })

  /* 목차만 있고 `id` 가 없으면 눌러도 아무 일이 안 난다 — 긴 문서에서 가장 티가 안 난다 */
  test('목차에서 조문으로 뛴다', async ({ page }) => {
    await page.goto('/terms')

    await page
      .getByRole('navigation', { name: '목차' })
      .getByRole('link', { name: /제12조/ })
      .click()

    await expect(page).toHaveURL(/#article-12$/)
    await expect(page.locator('#article-12')).toBeInViewport()
  })
})
```

> **푸터가 없는 화면이 둘 있다.** (1) `(auth)` 그룹(`/login` · `/signup`)은 `AppShell`
> 밖이라 헤더도 푸터도 없다. (2) 지도가 뷰포트를 채우는 라우트는 `globals.css` 의
> `body:has(.map-canvas-height) .site-footer` 가 푸터를 감춘다. 그래서 푸터 링크
> 테스트는 **홈(`/`)** 에서 출발한다. 이 테스트가 "푸터를 못 찾는다" 로 실패하면
> 출발 화면부터 의심한다.

- [ ] **Step 2: e2e 를 돌린다**

Run: `cd frontend && pnpm e2e e2e/legal-documents.spec.ts`
Expected: PASS — 4개

- [ ] **Step 3: 전체 검증을 돌린다**

Run: `cd frontend && pnpm verify`
Expected: PASS — 린트·타입·단위 테스트. **`verify` 에 `format:check` 는 없다** — 포맷은 pre-push 훅이 따로 본다

> 포맷 실패가 나면 **실제 저장소 경로에서** 확인한다. `/tmp` 복사본은 prettier 설정이
> 붙지 않아 "원래 그랬다" 로 오진한다. pre-push 훅이 `format:check` 를 돌린다.

- [ ] **Step 4: 커밋**

```bash
cd frontend
git add e2e/legal-documents.spec.ts
git commit -m "[FE] test: 로그아웃 상태에서 약관이 열리는지 e2e 로 잰다 (#610)"
```

- [ ] **Step 5: 브라우저로 실제 화면을 확인한다**

FE dev 서버는 Bash 에서 띄운다 (`preview_start` 는 샌드박스에 막힌다).

**5174 를 쓰지 않는다.** 그 포트는 보통 **다른 체크아웃**(메인 워크트리)이 이미 잡고 있어서, 붙으면 이 브랜치의 변경이 **없는** 화면을 보게 된다 — 확인했는데 아무것도 안 바뀐 것처럼 보이는 함정이다. 띄우기 전에 `lsof -nP -iTCP:5174 -sTCP:LISTEN` 로 점유를 확인하고, 잡혀 있으면 그 프로세스의 `cwd` 를 보고(`lsof -a -p <PID> -d cwd -Fn`) **남의 서버를 끄지 말고** 다른 포트를 쓴다.

```bash
cd frontend && pnpm dev:alt2
```

(5175. 카카오 지도 키 도메인 문제는 이 두 페이지와 무관하다 — 지도를 쓰지 않는다.)

확인할 것:

- 390 폭에서 처리방침 제2조 표가 **페이지를 가로로 밀지 않는다** (표 자신만 스크롤한다)
- 목차에서 제12조를 누르면 제목이 고정 헤더에 가리지 않는다
- 다크 모드에서 표 테두리와 본문 대비가 살아 있다

> 확인이 끝나면 띄운 서버를 정리한다. **다른 세션의 서버는 건드리지 않는다.**

- [ ] **Step 6: 배포 게이트를 확인한다 — 코드로 잡을 수 없는 것**

- [ ] `LEGAL_CONTACT.officerName` 이 `최성호` 로 들어갔는가
- [ ] 시행일 `2026-09-15` 가 실제 공개일 이후인가 — 아니면 두 문서의 `effectiveDate` 와 `history[0].effectiveDate` 를 함께 고친다
- [ ] #609 확인 결과가 처리방침 제3조의 "탈퇴 회원의 재가입 제한을 위한 정보" 행에 반영되었는가
- [ ] **사람이 두 문서 전문을 한 번 읽었는가** — 이 초안은 법률 자문이 아니다

- [ ] **Step 7: PR 을 연다**

`pr` 스킬로 본문을 쓰고, `Issue Number` 에 `#610` 을 채운다. 백엔드 선행 이슈 #607 · #608 · #609 를 본문에 링크해 **동의 수집이 아직 없다는 사실**을 리뷰어가 알게 한다.

---

## Self-Review

**1. 명세 커버리지**

| 명세 절 | 태스크 |
| --- | --- |
| S3 수집 항목 실측 | Task 3 Step 4 (제2조 표) |
| S4-1 처리방침 12개 절 + AI·위치 | Task 3 |
| S4-2 약관 15개 조 (제10·12조 포함) | Task 2 |
| S5-1 타입 | Task 1 |
| S5-2 본문/화면 문구 분리 | Task 4 |
| S5-3 렌더러 | Task 5 |
| S6 진입점 둘 + 테스트 뒤집기 | Task 7 · Task 8 |
| S6 회원가입 화면 미변경 | 어느 태스크도 건드리지 않는다 (의도) |
| S7 개정 관리 | Task 1 타입 + Task 5 이력 렌더 |
| S8 검증 5종 | Task 1 · Task 3 · Task 5 · Task 9 |
| S8-1 배포 게이트 | Task 3 Step 1 (연락처는 테스트로 강제) + Task 9 Step 6 |
| S9 백엔드 이슈 | 발의 완료 (#607 · #608 · #609) |

**2. 플레이스홀더 점검** — 남아 있지 않다. 사람이 정해야 했던 유일한 값(보호책임자 성명)은 `최성호` 로 확정됐고, 그럼에도 빈 값에서 실패하는 테스트를 남겨 개정 중 지워지는 것을 막는다. 나머지 단계는 실제 코드를 담고 있다.

**3. 타입 일관성** — `doc` prop 이름이 Task 5 정의와 Task 6 두 라우트의 호출에서 같다. `LEGAL_LINKS` 는 Task 4 에서 정의하고 Task 7 · Task 8 이 같은 이름으로 쓴다. `LEGAL_DOCUMENTS` 는 Task 1 에서 빈 배열로 만들어 Task 2 · Task 3 이 차례로 채운다. `messages.legal.articleLabel` 시그니처 `(no: number) => string` 이 Task 5 렌더러와 Task 5 테스트에서 같다.

---

## Task 10: `/about` 에 약관 링크 (리베이스 중 추가)

> **이 태스크는 원래 계획에 없었다.** `origin/develop` 위로 리베이스하면서 드러난 결함에
> 대응한다 — 이슈 #611 이 `@media (width < 48rem)` 에서 **푸터를 통째로 감췄다.**
> 그래서 Task 7 이 푸터에 건 약관 링크가 768 미만에서 보이지 않고, 마이페이지는 로그인이
> 필요하며 `(auth)` 그룹에는 원래 푸터가 없다. 결과적으로 **로그인하지 않은 모바일
> 방문자는 가입 전에 약관을 읽을 길이 하나도 없다.** 명세의 성공 기준 4번이 모바일에서
> 거짓이 된다.
>
> `/about` 이 정확히 이 문제를 위해 만들어진 화면이다 — "푸터가 감춰지는 모바일에서 푸터
> 내용이 사라지는 것을 막는 자리"(`app/globals.css` · `about-view.tsx` 머리 주석).
> 약관도 같은 이유로 같은 자리에 있어야 한다.

**Files:**
- Modify: `frontend/src/lib/messages/about.ts`
- Modify: `frontend/src/features/about/about-view.tsx`
- Modify: `frontend/src/features/about/about-view.test.ts`

**Interfaces:**
- Consumes: `LEGAL_LINKS` (Task 4), `SurfaceList`·`Surface` (`@/components/surface`), `ChevronRightIcon` (`@/components/icons`)
- Produces: 없음 (마지막 진입점)

- [ ] **Step 1: 문구를 더한다**

`frontend/src/lib/messages/about.ts` 의 `noticeTitle` 항목 **다음**에 두 줄을 더한다:

```ts
  legalTitle: '약관',
  legalDescription: '가입 전에도 읽을 수 있어요.',
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`frontend/src/features/about/about-view.test.ts` 의 `import` 블록에 한 줄을 더한다 (경로 순서상 `@/features/about/about-view` 다음):

```ts
import { LEGAL_LINKS } from '@/lib/legal/links'
```

파일 끝에 붙인다:

```ts
describe('AboutView — 모바일의 약관 도달 경로', () => {
  /*
    **이 단언이 지키는 것은 링크가 아니라 접근성이다.** 푸터는 768 미만에서 감춰지고
    (`app/globals.css`), 마이페이지는 로그인이 필요하며, `(auth)` 그룹에는 푸터가 없다.
    이 세 가지가 동시에 참이라 **이 화면이 없으면 로그인하지 않은 모바일 방문자는
    가입 전에 약관을 읽을 수단이 없다.** 약관은 가입 전에 읽는 문서다.
  */
  it('약관·처리방침으로 가는 링크를 둔다', () => {
    expect(markup).toContain(messages.about.legalTitle)

    for (const link of LEGAL_LINKS) {
      expect(markup).toContain(`href="${link.href}"`)
      expect(markup).toContain(link.label)
    }
  })

  /*
    푸터·마이페이지와 **같은 목록**을 읽는다. 여기서 문자열을 다시 지으면 같은 문서가
    화면마다 다른 이름으로 보인다 — 출처 문구를 `messages.footer` 에서 읽는 것과 같은 축이다.
  */
  it('링크 라벨을 다시 짓지 않고 LEGAL_LINKS 를 읽는다', () => {
    const source = readSourceWithoutComments('src/features/about/about-view.tsx')

    expect(source).toContain('LEGAL_LINKS.map')
    expect(source).not.toContain('이용약관')
    expect(source).not.toContain('개인정보 처리방침')
  })
})
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `cd frontend && pnpm vitest run src/features/about/about-view.test.ts`
Expected: FAIL — `href="/terms"` 를 찾지 못한다

- [ ] **Step 4: 카드를 더한다**

`frontend/src/features/about/about-view.tsx` 의 import 블록을 아래로 바꾼다 (패키지 블록이 먼저다):

```tsx
import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { Surface, SurfaceList } from '@/components/surface'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
```

머리 주석의 마지막 문단 **다음**에 한 문단을 더한다:

```tsx
 * **약관 링크도 같은 이유로 여기 있다** (#610). 푸터가 감춰지는 768 미만에서 마이페이지는
 * 로그인이 필요하고 `(auth)` 그룹에는 푸터가 없어, 이 화면이 없으면 **가입 전 모바일
 * 방문자가 약관을 읽을 수단이 사라진다.** 출처와 같은 구조의 문제다.
```

마지막 `Surface`(`about-notice-heading`) **다음**에 카드를 하나 더한다:

```tsx
      {/*
        **이동 항목이라 `SurfaceList` 다** — 마이페이지 계정 섹션과 같은 모양을 쓴다
        (`account-section.tsx`). 같은 역할의 행이 화면마다 다르게 생기지 않게 한다.
      */}
      <Surface
        titleId="about-legal-heading"
        title={messages.about.legalTitle}
        description={messages.about.legalDescription}
      >
        <SurfaceList>
          {LEGAL_LINKS.map((link) => (
            <li key={link.href} className={INSET_CLASS.card}>
              <Link
                href={link.href}
                className="focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                <span className="text-body-1 text-fg flex-1">{link.label}</span>
                <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
              </Link>
            </li>
          ))}
        </SurfaceList>
      </Surface>
```

- [ ] **Step 5: 통과를 확인한다**

Run: `cd frontend && pnpm vitest run src/features/about/about-view.test.ts`
Expected: PASS

그다음 `pnpm verify` 와 `pnpm format:check` 를 돌린다. 걸리는 파일이 있으면 `pnpm exec prettier --write <경로>`.

- [ ] **Step 6: 커밋**

```bash
cd frontend
git add src/lib/messages/about.ts src/features/about/about-view.tsx src/features/about/about-view.test.ts
git commit -m "[FE] feat: /about 에 약관 링크를 둬 모바일 도달 경로를 연다 (#610)"
```
