import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { CHARACTER } from '@/features/about/about-character'
import { AboutView } from '@/features/about/about-view'
import { poseForGrade, poseForStep } from '@/features/about/curve-pose'
import { REVEAL_HIDDEN_CLASS } from '@/features/about/reveal'
import { readGlobalsCss } from '@/test/tokens'

/**
 * 소개 페이지 캐릭터 (#917, 명세 `docs/superpowers/specs/2026-09-25-about-interactive-design.md` §6).
 *
 * 지키는 것은 넷이다 — **세 자리에만** 서는가, 스크린리더에 **없는** 그림인가, **등급 색을
 * 칠하지 않는가**, 정적 렌더가 끝 상태(질문 2 는 앞발 + 열기 선)인가.
 */
const markup = renderToStaticMarkup(createElement(AboutView))

/** 절 하나의 마크업 — `aria-labelledby` 로 여는 section 부터 다음 section 전까지 */
const section = (headingId: string) => {
  const start = markup.indexOf(`aria-labelledby="${headingId}"`)
  expect(start, headingId).toBeGreaterThan(0)
  const next = markup.indexOf('<section', start + 1)
  return markup.slice(start, next === -1 ? undefined : next)
}

/**
 * 캐릭터 `img` 태그 — **URL 을 풀어서** 본다. 테스트 환경은 `next.config.ts` 를 읽지 않아
 * `unoptimized` 가 꺼진 채로 렌더되고, `next/image` 가 경로를 `/_next/image?url=%2F…` 로 감싼다.
 */
const characterImages = (html: string) =>
  (html.match(/<img [^>]*>/g) ?? [])
    .map((tag) => decodeURIComponent(tag))
    .filter((tag) => tag.includes('/illustrations/about/'))

/**
 * 캐릭터 래퍼의 **여는 태그**만 — 마크업 전체로 단언하면 이웃 요소의 클래스가 섞인다. 클래스
 * 이름 끝을 공백 · 따옴표로 닫는다 — `\b` 면 자리 여백(`about-pose-room` 등)까지 잡혀, 개가
 * 사라져도 여백 div 덕에 통과한다(#917 검토).
 */
const wrapperTags =
  markup.match(/<(?:span|div) [^>]*class="[^"]*about-(?:hero-dog|pose|cta-dog)(?=[\s"])[^>]*>/g) ??
  []

describe('캐릭터 — 세 자리', () => {
  it('illustrations/about/ 참조가 히어로 · 질문 2 · 마무리 세 곳에만 있다', () => {
    expect(characterImages(section('about-hero-heading'))).toHaveLength(1)
    // 산책 · 서기 · 앞발 · 열기 선
    expect(characterImages(section('about-q2-heading'))).toHaveLength(4)
    expect(characterImages(section('about-cta-heading'))).toHaveLength(1)
    for (const id of [
      'about-q1-heading',
      'about-q3-heading',
      'about-q4-heading',
      'about-data-heading',
    ]) {
      expect(characterImages(section(id)), id).toHaveLength(0)
    }
    expect(characterImages(markup)).toHaveLength(6)
  })

  it('자리마다 맞는 자세를 쓴다 — 히어로는 올려다보기, 마무리는 정면', () => {
    expect(characterImages(section('about-hero-heading'))[0]).toContain(CHARACTER.sitLookup.src)
    expect(characterImages(section('about-cta-heading'))[0]).toContain(CHARACTER.sitFront.src)
  })
})

describe('캐릭터 — 접근성', () => {
  it('캐릭터 이미지는 alt 가 비어 있다', () => {
    for (const tag of characterImages(markup)) expect(tag).toContain('alt=""')
  })

  it('이미지를 감싸는 요소가 aria-hidden 이다 — 사이에 닫는 태그가 없다', () => {
    const images = [...markup.matchAll(/<img [^>]*>/g)].filter((match) =>
      decodeURIComponent(match[0]).includes('/illustrations/about/'),
    )
    expect(images).toHaveLength(6)
    for (const match of images) {
      const before = markup.slice(0, match.index)
      const opener = before.lastIndexOf('<span aria-hidden="true"')
      expect(opener, match[0]).toBeGreaterThan(0)
      expect(before.slice(opener), match[0]).not.toContain('</span>')
    }
  })
})

describe('캐릭터 — 색 · 끝 상태', () => {
  it('래퍼 여는 태그가 세 자리 하나씩만 잡힌다 — 자리 여백 div 는 섞이지 않는다', () => {
    expect(wrapperTags).toHaveLength(3)
    expect(wrapperTags.some((tag) => tag.includes('about-hero-dog'))).toBe(true)
    expect(wrapperTags.some((tag) => tag.includes('about-pose'))).toBe(true)
    expect(wrapperTags.some((tag) => tag.includes('about-cta-dog'))).toBe(true)
  })

  it('캐릭터 래퍼 · 이미지에 metric- 클래스가 없다 — 등급 색을 칠하지 않는다', () => {
    for (const tag of [...wrapperTags, ...characterImages(markup)]) {
      expect(tag).not.toMatch(/metric-/)
    }
  })

  it('정적 렌더의 질문 2 자세는 hot 이다 — 카드 배지가 위험이고 절의 요점이 뜨거운 노면이다', () => {
    const pose = section('about-q2-heading').match(/<span [^>]*class="about-pose"[^>]*>/)?.[0] ?? ''
    expect(pose).toContain('data-pose="hot"')
  })

  it('정적 마크업에 숨김 클래스가 없다', () => {
    for (const tag of wrapperTags) {
      for (const hidden of REVEAL_HIDDEN_CLASS.split(' ')) expect(tag).not.toContain(hidden)
    }
  })
})

describe('자세 표 (명세 §6-3)', () => {
  it('단계 2 · 4 는 앞발, 0 · 1 · 3 은 목줄 산책이다', () => {
    expect([0, 1, 2, 3, 4].map(poseForStep)).toEqual(['leash', 'leash', 'hot', 'leash', 'hot'])
  })

  it('핸들 판정은 서버 code 로 고른다 — 안전 산책 · 주의 서기 · 위험 앞발', () => {
    expect(poseForGrade('SAFE')).toBe('leash')
    expect(poseForGrade('CAUTION')).toBe('stand')
    expect(poseForGrade('DANGER')).toBe('hot')
  })
})

describe('에셋 표', () => {
  /** PNG 는 8바이트 서명 뒤 IHDR 청크의 폭 · 높이(빅엔디언 4바이트씩)로 시작한다 */
  const pngSize = (src: string) => {
    const bytes = readFileSync(path.join(process.cwd(), 'public', src))
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }

  it('width/height 가 실제 파일 치수와 같다', () => {
    for (const [name, asset] of Object.entries(CHARACTER)) {
      expect(pngSize(asset.src), name).toEqual({ width: asset.width, height: asset.height })
    }
  })
})

describe('globals.css 소개 페이지 캐릭터 블록', () => {
  const css = readGlobalsCss()
  const start = css.lastIndexOf('/*', css.indexOf('소개 페이지 캐릭터'))
  const end = css.indexOf('모션 민감 사용자를 존중한다')
  const block = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '')

  it('블록이 감속 모션 블록 위에 있다', () => {
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
  })

  it('앞발일 때만 열기 선이 보인다', () => {
    expect(block).toMatch(/\.about-pose-heat \{[^}]*transform: translateY/)
    expect(block).toMatch(
      /\.about-pose\[data-pose='hot'\] \.about-pose-heat[^{]*\{[^}]*opacity: 1;/,
    )
    expect(block).not.toMatch(/data-pose='(?:leash|stand)'\] \.about-pose-heat/)
  })

  it('색을 쓰지 않는다 — 등급 색 · hex · !important 가 없다', () => {
    expect(block).not.toMatch(/metric/)
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(block).not.toContain('!important')
  })

  it('새 duration 을 만들지 않는다 — 150(투명도) · 200(등장 · 변형), 지연 500 하나', () => {
    const values = [...block.matchAll(/(\d+)ms/g)].map((match) => match[1])
    for (const value of values) expect(['150', '200', '500']).toContain(value)
    expect(values.filter((value) => value === '500')).toHaveLength(1)
  })

  it('반복 애니메이션이 없다', () => {
    expect(block).not.toMatch(/infinite/)
  })
})
