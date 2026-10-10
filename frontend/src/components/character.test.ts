import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { Banner } from '@/components/banner'
import { CHARACTER, type StateCharacterPose } from '@/components/character'
import { EmptyState } from '@/components/empty-state'
import { openingTags, readSourceWithoutComments } from '@/test/source'

/**
 * 캐릭터를 `/about` 밖으로 넓히며 지키는 것 (#939, DESIGN.md §0-5).
 *
 * **자리는 목록이다.** 규칙이 "데이터가 없는 순간에만" 이라는 문장으로만 남으면 다음 사람이
 * 판정 옆 · 목록 행 · 응급 화면에 개를 앉힌다 — 각자에게는 그럴듯한 자리라서다. 그래서 캐릭터를
 * 부르는 파일과 자세를 소스에서 모아 이 표와 **정확히** 대조한다. 목록 밖에서 쓰면 여기서
 * 깨지고, 목록에서 빠진 자리가 생겨도 깨진다.
 */
const ALLOWED: Record<string, StateCharacterPose[]> = {
  // A — 전역 404 · AI 생성 중 · 반려견 없음 · 첫 일정 없음 · 공유 링크
  'app/not-found.tsx': ['sitLookup'],
  'src/features/ai-plan/ai-plan-progress.tsx': ['leash'],
  'src/features/pet/pet-list-section.tsx': ['sitFront'],
  'src/features/plan/plan-list-section.tsx': ['sitFront', 'leash'],
  'src/features/ai-plan/ai-plan-create-view.tsx': ['sitFront'],
  'src/features/plan/shared-plan-expired.tsx': ['sitLookup'],
  'src/features/plan/shared-plan-not-found.tsx': ['sitLookup'],
  // B — 인증 폼 카드 옆 · 홈 올레 배너 · 저장한 곳 없음 · 세그먼트 404 · AI 취소
  'src/features/auth/auth-card-dog.tsx': ['sitFront'],
  'src/features/home/home-view.tsx': ['leash'],
  'src/features/favorite/favorite-list-section.tsx': ['stand'],
  'app/(main)/places/[placeId]/not-found.tsx': ['sitLookup'],
  'app/(main)/plans/[planId]/not-found.tsx': ['sitLookup'],
  'app/(main)/pets/[petId]/not-found.tsx': ['sitLookup'],
  'src/features/walk-course/walk-course-detail-section.tsx': ['sitLookup'],
  'src/features/ai-plan/ai-plan-canceled.tsx': ['stand'],
}

/** 자세를 식으로 넘겨 받아 그리기만 하는 배관 — 자리가 아니다 */
const PLUMBING = ['src/components/empty-state.tsx', 'src/components/banner.tsx']

/**
 * 인증 카드 옆 개(`AuthCardDog`)가 서는 페이지 — **폼 화면 넷이다.** 셸(`layout.tsx`)에 두면
 * 같은 그룹의 OAuth 콜백(교환 중 · 실패 상태 화면)에도 서므로 페이지마다 부른다.
 */
const AUTH_CARD_DOG_PAGES = [
  'app/(auth)/login/page.tsx',
  'app/(auth)/password/reset/page.tsx',
  'app/(auth)/signup/page.tsx',
  'app/(auth)/signup/social/[provider]/page.tsx',
]

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

const sourceFiles = ['src', 'app'].flatMap((dir) =>
  readdirSync(`${ROOT}${dir}`, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.tsx') && !name.includes('.test.'))
    // 윈도에서는 `readdirSync` 가 `\\` 로 돌려준다 — 표의 키와 같은 `/` 로 맞춘다
    .map((name) => `${dir}/${name.replaceAll('\\', '/')}`),
)

/**
 * 파일마다 캐릭터 자세를 모은다 — `EmptyState` · `Banner` 의 `character="…"` 와
 * `<StateCharacter pose="…">`. **주석을 걷고 본다** — 이 기능의 주석은 자세 이름을 그대로 적는다.
 */
function collectUses() {
  const uses: Record<string, string[]> = {}
  const dynamic: string[] = []

  for (const file of sourceFiles) {
    const source = readSourceWithoutComments(file)
    const poses: string[] = []

    /*
      **식으로 넘긴 `character={…}` 도 잡는다** (#939 검토). 문자열만 세면
      `character={hasPets ? 'leash' : 'sitFront'}` 가 두 단언을 다 빠져나가 목록 밖 자리가 열린다.
      식은 자세를 읽을 수 없으므로 `dynamic` 으로 보내고, 그것이 배관과 정확히 같아야 한다.
    */
    for (const match of source.matchAll(/(?<![\w-])character=(?:"(\w+)"|\{)/g)) {
      if (match[1] === undefined) dynamic.push(file)
      else poses.push(match[1])
    }

    for (const tag of openingTags(source, /<StateCharacter\b/g)) {
      const literal = tag.match(/\bpose="(\w+)"/)?.[1]
      if (literal === undefined) dynamic.push(file)
      else poses.push(literal)
    }

    if (poses.length > 0) uses[file] = poses
  }

  return { uses, dynamic }
}

describe('캐릭터 — 허용 자리 (DESIGN.md §0-5)', () => {
  const { uses, dynamic } = collectUses()

  it('캐릭터를 부르는 파일과 자세가 허용 목록과 정확히 같다', () => {
    expect(uses).toEqual(ALLOWED)
  })

  it('자세를 식으로 넘기는 곳은 배관(EmptyState · Banner)뿐이다', () => {
    expect([...new Set(dynamic)].sort()).toEqual([...PLUMBING].sort())
  })

  it('인증 카드 옆 개는 폼 화면 넷에만 선다 — 셸 · OAuth 콜백에는 없다', () => {
    const pages = sourceFiles.filter((file) =>
      /<AuthCardDog\b/.test(readSourceWithoutComments(file)),
    )
    expect(pages.sort()).toEqual([...AUTH_CARD_DOG_PAGES].sort())
  })

  it('CharacterImage 를 직접 쓰는 곳은 공용 모듈과 /about 뿐이다', () => {
    const direct = sourceFiles.filter(
      (file) =>
        /<CharacterImage\b/.test(readSourceWithoutComments(file)) &&
        file !== 'src/components/character.tsx' &&
        !file.startsWith('src/features/about/'),
    )
    expect(direct).toEqual([])
  })

  it('에셋 경로를 적는 곳은 공용 모듈 하나다', () => {
    const paths = sourceFiles.filter((file) =>
      readSourceWithoutComments(file).includes('/illustrations/about/'),
    )
    expect(paths).toEqual(['src/components/character.tsx'])
  })
})

/** 캐릭터 `img` — `next/image` 가 감싼 URL 을 풀어 본다 (테스트 환경은 `unoptimized` 가 꺼져 있다) */
const characterImages = (html: string) =>
  (html.match(/<img [^>]*>/g) ?? [])
    .map((tag) => decodeURIComponent(tag))
    .filter((tag) => tag.includes('/illustrations/about/'))

/** `data-character` 래퍼의 여는 태그 */
const wrapper = (html: string) => html.match(/<span [^>]*data-character="[^"]*"[^>]*>/)?.[0] ?? ''

describe('EmptyState — character 슬롯', () => {
  const base = { title: '아직 저장한 장소가 없어요', description: '마음에 드는 곳을 저장해요' }

  it('넘기지 않으면 그림이 없다 — 기존 빈 상태는 그대로다', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, base))
    expect(characterImages(html)).toHaveLength(0)
    expect(html).toContain('flex flex-col items-start gap-2 py-12')
  })

  it('넘기면 그 자세 한 장이 aria-hidden 래퍼 안에 alt="" 로 선다', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { ...base, character: 'stand' }))
    const images = characterImages(html)
    expect(images).toHaveLength(1)
    expect(images[0]).toContain(CHARACTER.stand.src)
    expect(images[0]).toContain('alt=""')
    expect(wrapper(html)).toContain('aria-hidden="true"')
    expect(wrapper(html)).toContain('data-character="stand"')
  })

  it('글 묶음이 먼저, 개가 뒤다 — 제목이 왼쪽 기준선에 남는다', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { ...base, character: 'stand' }))
    expect(html.indexOf(base.title)).toBeLessThan(html.indexOf('data-character'))
    // 가운데로 모으거나 양 끝으로 벌리지 않는다
    expect(html).not.toMatch(/justify-(?:center|between)/)
    expect(html).not.toContain('text-center')
  })

  it('래퍼에 등급 색 · danger 가 없다', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { ...base, character: 'leash' }))
    // 래퍼가 사라지면 아래 부정 단언이 빈 문자열로 헛되이 통과한다
    expect(wrapper(html)).not.toBe('')
    expect(wrapper(html)).not.toMatch(/metric-|danger-/)
  })
})

describe('Banner — character 슬롯', () => {
  const base = { title: '제주올레 걸어 보기', href: '/olle' }

  it('캐릭터는 danger 아이콘 칸(leading) 밖에 선다', () => {
    const html = renderToStaticMarkup(
      createElement(Banner, {
        ...base,
        character: 'leash',
        leading: createElement('svg', { 'data-testid': 'icon' }),
      }),
    )
    const leadingStart = html.indexOf('text-danger-500')
    expect(leadingStart).toBeGreaterThan(-1)
    const leadingEnd = html.indexOf('</span>', leadingStart)
    expect(html.slice(leadingStart, leadingEnd)).toContain('data-testid="icon"')
    expect(html.slice(leadingStart, leadingEnd)).not.toContain('data-character')
    expect(characterImages(html)).toHaveLength(1)
    expect(wrapper(html)).toContain('aria-hidden="true"')
  })

  it('발을 카드 아랫선에 댄다 — 링크의 py-4 만큼 내린다', () => {
    const html = renderToStaticMarkup(createElement(Banner, { ...base, character: 'leash' }))
    expect(wrapper(html)).toMatch(/-mb-4/)
    expect(wrapper(html)).toMatch(/self-end/)
    expect(wrapper(html)).toMatch(/\bh-16\b/)
  })

  /*
    **캐릭터가 서면 꺾쇠가 없다.** 둘이 나란히 서면 레일 폭(362)에서 설명 줄이 꺾쇠 몫만큼
    밀려 두 줄로 접혔다. 캐릭터가 없는 배너(병원 · AI)는 꺾쇠가 이동의 유일한 신호라 남는다.
  */
  it('캐릭터가 서면 꺾쇠를 그리지 않고, 없으면 그린다', () => {
    const withCharacter = renderToStaticMarkup(
      createElement(Banner, { ...base, character: 'leash' }),
    )
    const without = renderToStaticMarkup(createElement(Banner, base))
    expect(withCharacter).not.toContain('<svg')
    expect(without).toContain('<svg')
  })

  it('넘기지 않으면 그림이 없다', () => {
    expect(characterImages(renderToStaticMarkup(createElement(Banner, base)))).toHaveLength(0)
  })
})
