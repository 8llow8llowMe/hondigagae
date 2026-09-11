/**
 * 반려견 등록·수정 화면이 3층 표면 위에 선다 — 이슈 #464.
 *
 * **소스를 문자열로 읽는다.** 두 뷰는 `usePetDetail` · `useForm` · `useRouter` ·
 * `useQueryClient` 가 걸려 있어 node 환경에서 렌더되지 않고(`testing-guide.md` §1),
 * 페이지는 서버 컴포넌트다. 여기서 지키려는 것은 렌더 결과가 아니라 **표면 계약**이다 —
 * 무엇이 바닥이고 무엇이 카드이며 인셋이 어느 값인가. 일정 만들기(#453)의
 * `plan-create-surface.test.ts` 와 같은 방식이고, **`PetForm` 의 `footer` prop 을 걷어
 * 배치 책임이 전부 `PetEditView` 로 넘어갔으므로** 그 배치를 지키는 장치가 필요하다.
 *
 * **주석을 걷은 사본에 대해 단언한다.** 이 저장소의 주석은 근거를 길게 적어 클래스명·
 * 컴포넌트명이 주석 안에 그대로 등장한다 — 걷지 않으면 주석 문자열에 속아 통과한다.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/** 블록 주석과 줄 주석을 걷은 소스 — 계약은 코드에만 있다 */
function code(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const newPage = code('app/(main)/pets/new/page.tsx')
const editPage = code('app/(main)/pets/[petId]/page.tsx')
const createView = code('src/features/pet/pet-create-view.tsx')
const editView = code('src/features/pet/pet-edit-view.tsx')
const form = code('src/features/pet/pet-form.tsx')

describe.each([
  ['등록', newPage],
  ['수정', editPage],
])('%s 페이지가 바닥과 쌓기를 가른다 (#464)', (_name, page) => {
  it('Canvas 와 SurfaceStack 을 쓴다', () => {
    expect(page).toContain("import { Canvas, SurfaceStack } from '@/components/surface'")
    expect(page).toContain('<Canvas as="main" id="main-content">')
  })

  /*
    바닥은 전폭이어야 한다 (§0). 폭 제한이 `Canvas` 쪽에 붙으면 컨테이너 바깥이 흰색으로
    남는다 — 예전 `main` 이 `mx-auto max-w-lg` 로 그 둘을 겸하고 있었다.
  */
  it('max-w-2xl 이 Canvas 가 아니라 SurfaceStack 에 붙는다', () => {
    expect(page).toMatch(/<SurfaceStack className="[^"]*max-w-2xl/)
    expect(page).not.toMatch(/<Canvas[^>]*max-w-/)
  })

  it('페이지가 자기 페이지 인셋을 다시 주지 않는다', () => {
    expect(page).not.toMatch(/<Canvas[^>]*\bp[xy]?-\d/)
    expect(page).not.toMatch(/<SurfaceStack className="[^"]*\bp[xy]?-\d/)
  })

  /* 카드를 뷰가 그린다 — 페이지가 그리기 시작하면 액션이 카드 안으로 들어갈 길이 열린다 */
  it('페이지는 카드를 그리지 않는다', () => {
    expect(page).not.toMatch(/<Surface[\s/>]/)
  })

  it('보이는 제목은 카드가 그린다 — 페이지 h1 은 sr-only 다', () => {
    expect(page).toContain('<h1 className="sr-only">')
    expect(page).not.toContain('text-title-1')
    expect(page).not.toContain('text-display')
  })
})

describe('등록 — 카드 하나 (#464)', () => {
  it('뷰가 lead 카드를 그린다', () => {
    expect(createView).toContain("import { Surface } from '@/components/surface'")
    expect(createView).toMatch(/<Surface\s+lead\b/)
    expect(createView.match(/<Surface[\s/>]/g)).toHaveLength(1)
  })

  it('카드 제목은 페이지 이름이다 — 카드가 하나뿐이다', () => {
    expect(createView).toContain('title={messages.pet.newTitle}')
  })

  it('목록으로 는 카드 밖이다 — 페이지가 세운다', () => {
    expect(newPage).toContain('href="/pets"')
    expect(createView).not.toContain('backToList')
  })

  it('폼 래퍼가 INSET_CLASS.card 를 쓴다', () => {
    expect(createView).toContain('INSET_CLASS.card')
    expect(createView).not.toContain('INSET_CLASS.main')
  })
})

describe('수정 — 카드 둘 (#464)', () => {
  /*
    **카드 경계가 "바로 반영" 과 "저장해야 반영" 을 가른다.** 2a 때는 `PetPhotoSection` 의
    `border-b` 와 삭제의 `border-t` 가 그 일을 했다 — 그 수제 구분선이 돌아오면 카드가
    한 장으로 합쳐진 것이다.
  */
  it('카드가 둘이다 — 사진·대표와 정보 수정', () => {
    /* 제목을 가진 카드는 둘이고, 나머지 셋은 로딩 두 장 + 오류 한 장이다(아래 단언) */
    expect(editView.match(/<Surface[\s/>]/g)).toHaveLength(5)
    expect(editView.match(/title=\{messages\.pet\./g)).toHaveLength(2)
    expect(editView).toContain('title={messages.pet.photoSectionTitle}')
    expect(editView).toContain('title={messages.pet.editFormTitle}')
  })

  it('로딩·오류도 카드 안이다 — 카드가 생겼다 사라지지 않는다', () => {
    // 로딩 두 장 + 오류 한 장 + 사진 카드 + 폼 카드 중, 제목 없는 갈래는 aria-label 을 쓴다
    expect(editView.match(/<Surface aria-label=/g)).toHaveLength(3)
    expect(editView).toMatch(/<ErrorState\s+inset="card"/)
  })

  /*
    **폼 카드가 주인공이다** — `DESIGN.md §3-1` 은 `lead` 를 "화면의 주인공 섹션" 으로
    못박는다. 등록 화면과 같은 폼이 같은 크기로 서야 한다.
  */
  it('lead 는 폼 카드가 갖는다', () => {
    expect(editView).toMatch(/<Surface\s+lead\s+titleId="pet-edit-heading"/)
  })

  it('폼 카드 제목이 페이지 이름과 갈린다 — h1 과 같은 문구를 두 번 말하지 않는다', () => {
    expect(editPage).toContain('{messages.pet.editTitle}')
    expect(editView).not.toContain('title={messages.pet.editTitle}')
  })

  it('삭제와 목록으로 는 카드 밖 한 묶음이다', () => {
    // 카드 안에 들어가면 `Surface` 닫힘 뒤가 아니라 그 사이에 오게 된다
    const afterCards = editView.slice(editView.lastIndexOf('</Surface>'))

    expect(afterCards).toContain('<PetDeleteSection')
    expect(afterCards).toContain('href="/pets"')
  })

  it('폼 래퍼가 INSET_CLASS.card 를 쓴다', () => {
    expect(editView).toContain('INSET_CLASS.card')
    expect(editView).not.toContain('INSET_CLASS.main')
  })
})

describe('PetForm — 카드 안에 드는 폼 (#464)', () => {
  /*
    **`footer` prop 을 걷었다.** 삭제와 `목록으로` 가 둘 다 카드 밖으로 나가면서 폼이
    자기 아래에 남의 것을 그릴 이유가 사라졌다 — 배치는 `PetEditView` 가 갖는다.
  */
  it('footer prop 이 없다', () => {
    expect(form).not.toContain('footer')
  })

  /*
    **섹션 제목은 `h3` 다.** 카드가 `h2` 를 갖는데 폼 안 섹션이 같은 레벨에 남으면 문서
    구조가 평평해진다 — 목록 행을 `h3` 로 내린 것과 같은 이유다.
  */
  it('폼 안 섹션 제목이 h3 다', () => {
    expect(form).not.toContain('<h2')
    expect(form.match(/<h3/g)).toHaveLength(3)
  })

  it('폼이 자기 페이지 인셋을 갖지 않는다 — 인셋은 담는 카드가 준다', () => {
    expect(form).not.toContain('md:px-10')
  })
})
