import Link from 'next/link'

import type { ReactNode } from 'react'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'
import { ButtonLink } from '@/components/button'
import { ChevronRightIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { Surface, SurfaceList } from '@/components/surface'
import { CtaDog, HeroDog } from '@/features/about/about-character'
import {
  INDOOR_SPECIMEN,
  SCALE_SPECIMEN,
  SUITABILITY_SPECIMEN,
  WEATHER_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { CongestionSpecimen } from '@/features/about/congestion-specimen'
import { EmergencySpecimen } from '@/features/about/emergency-specimen'
import { FeatureTabs } from '@/features/about/feature-tabs'
import { GoldenCurveSpecimen } from '@/features/about/golden-curve-specimen'
import { HeroParallax, ScrollCue } from '@/features/about/hero-parallax'
import { IntroBand } from '@/features/about/intro-band'
import { PlacesSpecimen } from '@/features/about/places-specimen'
import { PlanSpecimen } from '@/features/about/plan-specimen'
import { Reveal } from '@/features/about/reveal'
import { ScaleCount } from '@/features/about/scale-count'
import { ScrollProgressBar } from '@/features/about/scroll-progress-bar'
import { ScrollStage, ScrollStagePoint } from '@/features/about/scroll-stage'
import { SectionNav } from '@/features/about/section-nav'
import { SplitHeading } from '@/features/about/split-heading'
import { Tag } from '@/features/about/tag'
import { VerdictSpecimen } from '@/features/about/verdict-specimen'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 서비스 소개 — `/about` (#611 → #635).
 *
 * **서버 컴포넌트다.** 세션도 프리페치도 없고 백엔드를 부르지 않는다. 클라이언트 경계는
 * `Reveal` · `ScrollStage`(+ `ScrollStagePoint`) · `FeatureTabs`(#940) · 예시 4개다 (명세 §6-4 ·
 * 2026-09-25 §9-1).
 *
 * **캐릭터는 세 자리에만 선다** (#917, 명세 2026-09-25 §6) — 히어로(올려다보기) · 질문 2 곡선
 * 카드 윗변(단계 · 핸들에 따른 자세) · 마무리(정면 앉기). 질문 1 · 질문 3 · 위급 · 데이터에는
 * 두지 않는다 — 그 절의 문장과 묶이지 않는다. 늘 카드 **밖**에 서고 등급 색을 칠하지 않는다.
 *
 * **질문 1 · 질문 2 · 위급 절은 스크롤 무대다** (#914, 명세 2026-09-25 §3). 왼쪽 항목이 화면
 * 가운데에 올 때마다 오른쪽 예시가 그 항목이 말하는 상태가 된다. 고정 예시 위에는 맥락 줄
 * (`표지어 · 제목` + 바로가기)이 붙는다(#940). 데이터 절은 심사자 몫이라 훑기가 우선이다.
 * 무대 안 예시는 `Reveal` 로 감싸지 않는다 — 무대가 등장을 대신하고, 둘이 겹치면 단계 0 이
 * 두 번 숨는다.
 *
 * **질문 3 은 무대가 아니라 목록 + 예시 하나다** (#940, `FeatureTabs`). 네 항목이 저마다
 * 인터랙션을 가진 예시라 스크롤로 넘기면 예시 안 조작과 부딪히고, 무대가 네 번 이어지면
 * 단조롭다. 1024 이상에서 절이 헤더 아래 한 화면을 채워 "멈춰서 눌러 보는 곳" 이 된다.
 *
 * 절은 보호자의 **질문 순서**다: 데려가도 돼요? → 지금 나가도 돼요? → 오늘 어디 가요? →
 * 위급하면? → 무엇을 보고 판단하나요. 앞은 보호자, 마지막은 심사자 몫이다 (명세 §2 · §4).
 *
 * **홈과 경쟁하지 않는다.** 예시는 전부 고정값이고 캡션이 그것을 밝힌다. 실제 판정은 홈이
 * 답하고, 이 화면은 홈으로 보낸다.
 *
 * **출처 · 면책 · 공모전 표기는 `messages.footer` 를 그대로 읽는다** — 데스크톱(푸터)과
 * 모바일(이 화면)에서 같은 데이터의 출처가 갈리지 않게.
 *
 * **보호 라우트가 아니다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다. 보호 경로 링크
 * (`/ai-plans/new` · `/pets/new`)는 proxy 가 `returnTo` 를 붙이므로 바로 건다.
 *
 * **`h1` 이 보인다** — 히어로가 화면 제목이라 `h2` 는 `lg:` 에서 올라간다 (DESIGN.md §3-1 #358).
 *
 * **2단 배치는 전부 12열 그리드 위에 세운다.** `grid-cols-[minmax(0,1fr)_400px]` 같은
 * arbitrary 값은 lint 가 막는다 — 괄호가 든 arbitrary 를 Tailwind 가 조용히 무시하는 사고가
 * 있었다 (`eslint.config.mjs` `noComplexArbitrary`). 히어로는 카피 7 : 예시 5, 질문 절은
 * 카피 5 : 예시 7 이다.
 *
 * **히어로 예시 열이 12 중 5 인 이유는 폭이다.** 3열 중 1열(`lg:grid-cols-3`)이면 1024 에서
 * 판정 카드가 272px 로 **모바일보다 좁아진다** — 카드 안 수치 세 개가 한 줄에 서지 못한다.
 * 12열 5칸은 `gap-16` 기준 1024 에서 356px, 1280 에서 409px 로 모바일(358)과 거의 같다.
 */
export function AboutView() {
  const about = messages.about

  return (
    <>
      {/*
        첫 화면 리듬 (#915) — 진행선(1024 미만) · 절 내비(1280 이상)는 고정 요소라 어느 밴드에도
        속하지 않는다. 절 내비 라벨은 각 절의 제목(h2)을 그대로 읽는다 — 표지어(`질문 1` ·
        `그리고`)는 링크 이름으로 가는 곳을 말하지 못한다(WCAG 2.4.4).
      */}
      <ScrollProgressBar />
      <SectionNav
        label={about.nav.label}
        items={[
          { id: SECTION_ID.hero, label: about.nav.top },
          { id: SECTION_ID.q1, label: about.q1.heading },
          { id: SECTION_ID.q2, label: about.q2.heading },
          { id: SECTION_ID.q3, label: about.q3.heading },
          { id: SECTION_ID.q4, label: about.q4.heading },
          { id: SECTION_ID.data, label: about.data.heading },
        ]}
      />

      {/* ── 1. 히어로 ── */}
      <IntroBand
        id={SECTION_ID.hero}
        tone="brand"
        labelledBy="about-hero-heading"
        className="about-hero-fill grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-16"
      >
        <div className="lg:col-span-7">
          {/*
            락업 — `(auth)` 셸과 같은 2배 크기(심볼 48 · 워드마크 40). 히어로에는 데이터가 없어
            로고가 첫 시선을 받아도 된다 (DESIGN.md §1 · §0-2). 워드마크는 currentColor 라
            밴드의 `text-fg-inverse` 를 물려받고, 심볼은 `inverse` 톤으로 뒤집는다.

            `aria-hidden` 인 이유: `Wordmark` 가 `role="img" aria-label="혼디가개"` 를 갖는데
            바로 아래 `h1` 이 화면 제목이라 스크린리더가 이름을 한 번 더 읽을 필요가 없다 —
            헤더의 락업이 이미 사이트 이름을 말한다.
          */}
          <div className="mb-6 inline-flex items-center gap-4" aria-hidden>
            <BrandSymbol size={48} tone="inverse" />
            <Wordmark height={40} />
          </div>
          <p className="text-caption flex items-center gap-2 font-semibold tracking-wide">
            <span aria-hidden className="bg-fg-inverse inline-block size-1.5 rounded-full" />
            {about.hero.eyebrow}
          </p>
          <SplitHeading
            id="about-hero-heading"
            text={about.hero.heading}
            className="text-display md:text-page mt-3 font-extrabold break-keep"
          />
          <p className="text-body-1 mt-4 max-w-2xl font-normal break-keep opacity-90">
            {about.hero.sub}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/" variant="inverse">
              {about.hero.ctaPrimary}
            </ButtonLink>
            <ButtonLink href="/places" variant="inverseOutline">
              {about.hero.ctaSecondary}
            </ButtonLink>
          </div>
          <ScrollCue href={`#${SECTION_ID.q1}`}>{about.hero.scrollCue}</ScrollCue>
        </div>
        {/*
          예시는 자기 열을 갖는다 — `VerdictSpecimen` 이 grid 아이템이면 열 폭을 알 수 없다.
          캐릭터(#917)는 카드와 같은 패럴랙스 래퍼 안에서 카드 밖 왼쪽 아래에 선다. 1024 미만은
          카드 아래에 앉을 자리(`.about-hero-dog-room`)를 연다.
        */}
        <div className="about-hero-dog-room lg:col-span-5">
          <HeroParallax className="relative">
            <VerdictSpecimen />
            <HeroDog />
          </HeroParallax>
        </div>
      </IntroBand>

      {/* ── 2. 데려가도 돼요? ── */}
      <IntroBand tone="plain" id={SECTION_ID.q1} labelledBy="about-q1-heading">
        <ScrollStage
          count={about.q1.points.length}
          {...STAGE_GRID}
          copy={
            <QuestionCopy
              id="about-q1-heading"
              kicker={about.q1.kicker}
              heading={about.q1.heading}
              lead={about.q1.lead}
              points={about.q1.points}
              staged
              href="/places"
              link={about.q1.link}
            />
          }
          visual={<PlacesSpecimen />}
          context={
            <StageContextRow
              kicker={about.q1.kicker}
              heading={about.q1.heading}
              href="/places"
              link={about.q1.link}
            />
          }
        />
      </IntroBand>

      {/* ── 3. 지금 나가도 돼요? ── */}
      <IntroBand tone="tint" id={SECTION_ID.q2} labelledBy="about-q2-heading">
        <ScrollStage
          count={about.q2.points.length}
          {...STAGE_GRID}
          frameClassName="about-pose-room"
          copy={
            <QuestionCopy
              id="about-q2-heading"
              kicker={about.q2.kicker}
              heading={about.q2.heading}
              lead={about.q2.lead}
              points={about.q2.points}
              staged
              href="/"
              link={about.q2.link}
            />
          }
          visual={<GoldenCurveSpecimen />}
          context={
            <StageContextRow
              kicker={about.q2.kicker}
              heading={about.q2.heading}
              href="/"
              link={about.q2.link}
            />
          }
        />
      </IntroBand>

      {/*
        ── 4. 오늘 어디 가요? ── 목록 + 예시 하나 (#940). 1024 이상은 카피 5 : 예시 7 에 예시가
        세 행(머리 · 목록 · 링크)에 걸친다. 그 미만은 머리 → 칩 → 예시 → 링크로 쌓인다.
      */}
      <IntroBand
        tone="plain"
        id={SECTION_ID.q3}
        labelledBy="about-q3-heading"
        className="about-q3-fill"
      >
        <div className="grid lg:grid-cols-12 lg:items-start lg:gap-x-10">
          <QuestionCopy
            id="about-q3-heading"
            className="lg:col-span-5"
            kicker={about.q3.kicker}
            heading={about.q3.heading}
            lead={about.q3.lead}
          />
          <FeatureTabs
            label={about.q3.tablistLabel}
            listClassName="mt-4 lg:col-span-5 lg:mt-6"
            panelClassName="mt-4 lg:col-span-7 lg:col-start-6 lg:row-span-3 lg:row-start-1 lg:mt-0 lg:w-full lg:max-w-140 lg:self-center lg:justify-self-center"
            items={[
              {
                key: 'suitability',
                title: about.q3.cards.suitability.title,
                desc: about.q3.cards.suitability.desc,
                panel: (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-body-1 text-fg">{SUITABILITY_SPECIMEN.place}</p>
                      <MetricBadge tone="high" axis="suitability">
                        {about.specimen.suitabilityGrade}
                      </MetricBadge>
                    </div>
                    <ul className="mt-3 grid gap-2">
                      {about.specimen.suitabilityReasons.map((reason) => (
                        <li key={reason} className="text-body-2 text-fg flex gap-2">
                          <span
                            aria-hidden
                            className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full"
                          />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </>
                ),
              },
              {
                key: 'congestion',
                title: about.q3.cards.congestion.title,
                desc: about.q3.cards.congestion.desc,
                panel: <CongestionSpecimen />,
              },
              {
                key: 'aiPlan',
                title: about.q3.cards.aiPlan.title,
                tag: about.specimen.planAiTag,
                desc: about.q3.cards.aiPlan.desc,
                panel: <PlanSpecimen />,
              },
              {
                key: 'indoor',
                title: about.q3.cards.indoor.title,
                desc: about.q3.cards.indoor.desc,
                panel: (
                  <>
                    <div role="img" aria-label={about.specimen.weatherAria} className="flex gap-2">
                      {WEATHER_SPECIMEN.map((day) => (
                        <div key={day.day} className="bg-band flex-1 rounded-md p-2 text-center">
                          <p className="text-caption text-fg-muted font-semibold">{day.day}</p>
                          <p className="text-title-2 leading-7">{day.icon}</p>
                          <p className="text-caption text-fg font-semibold">{day.temp}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-body-2 text-fg mt-3 font-semibold">
                      {about.specimen.indoorTitle}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {INDOOR_SPECIMEN.map((item) => (
                        <Tag key={item} tone="neutral">
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </>
                ),
              },
            ]}
          />
          <MoreLink href="/ai-plans/new" className="mt-4 justify-self-start lg:col-span-5 lg:mt-3">
            {about.q3.link}
          </MoreLink>
        </div>
      </IntroBand>

      {/* ── 5. 위급하면? ── */}
      <IntroBand tone="tint" id={SECTION_ID.q4} labelledBy="about-q4-heading">
        <ScrollStage
          count={about.q4.points.length}
          {...STAGE_GRID}
          copy={
            <QuestionCopy
              id="about-q4-heading"
              kicker={about.q4.kicker}
              heading={about.q4.heading}
              lead={about.q4.lead}
              points={about.q4.points}
              staged
              href="/emergency"
              link={about.q4.link}
            />
          }
          visual={<EmergencySpecimen />}
          context={
            <StageContextRow
              kicker={about.q4.kicker}
              heading={about.q4.heading}
              href="/emergency"
              link={about.q4.link}
            />
          }
        />
      </IntroBand>

      {/* ── 6. 무엇을 보고 판단하나요 (+ 7. 알아두실 점) ── */}
      <IntroBand tone="plain" id={SECTION_ID.data} labelledBy="about-data-heading">
        <QuestionCopy
          id="about-data-heading"
          kicker={about.data.kicker}
          heading={about.data.heading}
          lead={about.data.lead}
        />
        <div className="mt-6 grid grid-cols-3 gap-2 md:gap-6">
          <ScaleTile value={SCALE_SPECIMEN.places} label={about.data.scaleLabels.places} />
          <ScaleTile
            value={SCALE_SPECIMEN.emergency}
            label={about.data.scaleLabels.emergency}
            delay={60}
          />
          <ScaleTile
            value={SCALE_SPECIMEN.sources}
            label={about.data.scaleLabels.sources}
            delay={120}
          />
        </div>
        <p className="text-caption text-fg-muted mt-2 font-medium">{about.data.scaleNote}</p>
        <ol className="mt-6 grid gap-2 md:grid-cols-2">
          {about.data.rules.map((rule, index) => (
            <li key={rule}>
              <Reveal delay={index * 60}>
                <div className="bg-bg border-border flex items-start gap-3 rounded-lg border px-4 py-3">
                  <span
                    aria-hidden
                    className="bg-fg text-fg-inverse text-caption grid size-6 shrink-0 place-items-center rounded-full font-bold"
                  >
                    {index + 1}
                  </span>
                  <p className="text-body-2 text-fg font-medium">{rule}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-2 md:grid-cols-2 md:gap-6">
          <Reveal>
            <Surface
              titleId="about-sources-heading"
              title={messages.footer.sourcesLabel}
              description={
                <p className="text-caption text-fg-muted font-medium">
                  {about.data.sourcesDescription}
                </p>
              }
              className="-mx-4 md:mx-0"
            >
              <ul className={cn('pb-3', INSET_CLASS.card)}>
                {messages.footer.sources.map((source, index) => (
                  <li
                    key={source}
                    className={cn(
                      'text-body-2 text-fg flex items-center gap-2 py-2 font-semibold',
                      index > 0 && 'border-border border-t',
                    )}
                  >
                    <span aria-hidden className="bg-brand-500 size-2 shrink-0 rounded-sm" />
                    {source}
                  </li>
                ))}
              </ul>
              <p className={cn('text-caption text-fg-muted pb-5 font-medium', INSET_CLASS.card)}>
                {about.data.architecture}
              </p>
            </Surface>
          </Reveal>
          <Reveal delay={60}>
            <Surface
              titleId="about-notice-heading"
              title={about.notice.title}
              className="-mx-4 md:mx-0"
            >
              <div className={cn('flex flex-col gap-2 pb-5', INSET_CLASS.card)}>
                <p className="text-body-2 text-fg-muted">{messages.footer.disclaimer}</p>
                <p className="text-caption text-fg-subtle font-medium">{messages.footer.contest}</p>
              </div>
            </Surface>
          </Reveal>
        </div>

        {/*
          **약관 행은 소개 페이지가 돼도 남는다** (#610). 푸터가 감춰지는 768 미만에서
          마이페이지는 로그인이 필요하고 `(auth)` 그룹에는 푸터가 없어, 이 화면이 빠지면
          **가입 전 모바일 방문자가 약관을 읽을 수단이 사라진다.** 출처가 여기 있는 이유와
          같은 축이라 같은 밴드에 둔다.

          **이동 항목이라 `SurfaceList` 다** — 마이페이지 계정 섹션(`account-section.tsx`) ·
          푸터와 같은 모양을 쓴다. 같은 역할의 행이 화면마다 다르게 생기지 않게 한다.
        */}
        <Reveal delay={120}>
          <Surface
            titleId="about-legal-heading"
            title={about.legal.title}
            description={
              <p className="text-caption text-fg-muted font-medium">{about.legal.description}</p>
            }
            className="-mx-4 mt-2 md:mx-0"
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
        </Reveal>
      </IntroBand>

      {/*
        ── 8. 마무리 CTA ──
        1024 이상은 히어로와 같은 7:5 — 오른쪽 열에 캐릭터가 정면으로 앉아 절 끝선에 발을 댄다
        (#917, 명세 2026-09-25 §6-2). 그 미만은 버튼 아래 오른쪽이다.
      */}
      <IntroBand
        tone="brand"
        labelledBy="about-cta-heading"
        className="grid gap-5 lg:grid-cols-12 lg:gap-x-16"
      >
        <div className="lg:col-span-7">
          <h2
            id="about-cta-heading"
            className="text-title-1 lg:text-display font-bold break-keep lg:font-extrabold"
          >
            {about.cta.heading}
          </h2>
          <p className="text-body-1 mt-2 font-normal break-keep opacity-90">{about.cta.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-7">
          <ButtonLink href="/" variant="inverse">
            {about.cta.primary}
          </ButtonLink>
          <ButtonLink href="/pets/new" variant="inverseOutline">
            {about.cta.secondary}
          </ButtonLink>
        </div>
        <CtaDog className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1" />
      </IntroBand>
    </>
  )
}

/**
 * 절 앵커 id — 절 내비 · 스크롤 힌트가 가리킨다 (#915). 제목 id(`about-*-heading`)와 따로
 * 두는 이유: 앵커로 이동하면 절 **맨 위**가 와야 하는데 제목 id 로 가면 표지어가 잘린다.
 */
const SECTION_ID = {
  hero: 'about-hero',
  q1: 'about-q1',
  q2: 'about-q2',
  q3: 'about-q3',
  q4: 'about-q4',
  data: 'about-data',
} as const

/**
 * 무대 절의 12열 배치 — 카피 5 : 예시 7 (머리 주석의 "2단 배치는 12열 그리드" 그대로).
 * sticky · 항목 높이는 `app/globals.css` 의 `.about-stage-*` 가 준다.
 */
const STAGE_GRID = {
  className: 'lg:grid lg:grid-cols-12 lg:gap-10',
  copyClassName: 'lg:col-span-5',
  visualClassName: 'mt-6 lg:col-span-7 lg:mt-0',
} as const

/**
 * 절 머리 — 표지어 · h2 · 리드 · (항목 · 링크).
 *
 * 항목은 두 모양이다. 무대 절(`staged`)은 `ScrollStagePoint` 로 그려 무대가 켜고 끄고,
 * 무대가 아닌 절은 항목마다 `Reveal` 로 60ms 씩 등장한다. 문장 · 아이콘은 어느 쪽이든 이
 * 서버 컴포넌트가 그린다.
 */
function QuestionCopy({
  id,
  className,
  kicker,
  heading,
  lead,
  points,
  staged = false,
  href,
  link,
}: {
  id: string
  className?: string
  kicker: string
  heading: string
  lead: string
  points?: readonly string[]
  /** 스크롤 무대 안의 절이다 (#914) */
  staged?: boolean
  href?: string
  link?: string
}) {
  return (
    <div className={className}>
      <p className="text-caption text-link font-semibold tracking-wide">{kicker}</p>
      <h2
        id={id}
        className="text-title-1 lg:text-display text-fg mt-1 font-bold break-keep lg:font-extrabold"
      >
        {heading}
      </h2>
      <p className="text-body-1 text-fg-muted mt-2 max-w-2xl font-normal break-keep">{lead}</p>
      {points !== undefined && (
        <ol className="mt-5 grid gap-3">
          {points.map((point, index) =>
            staged ? (
              <ScrollStagePoint key={point} index={index + 1} className="flex items-start gap-3">
                <PointBody index={index + 1}>{point}</PointBody>
              </ScrollStagePoint>
            ) : (
              <li key={point}>
                <Reveal delay={index * 60} className="flex items-start gap-3">
                  <PointBody index={index + 1}>{point}</PointBody>
                </Reveal>
              </li>
            ),
          )}
        </ol>
      )}
      {/*
        무대 절의 바로가기는 1024 이상에서 고정 카드 위 맥락 줄로 올라간다(#940) — 여기 남기면
        마지막 항목(58vh 칸 가운데)보다 화면의 30% 아래에 혼자 떠 있고 무대를 끝까지 내려야 보였다.
      */}
      {href !== undefined && link !== undefined && (
        <MoreLink href={href} className={cn('mt-3', staged && 'lg:hidden')}>
          {link}
        </MoreLink>
      )}
    </div>
  )
}

/**
 * 항목 하나의 몸 — 단계 번호 칸 + 문장 (#940).
 *
 * **문장은 행 제목 등급이다**(`text-body-1` → `lg:text-title-2`, 600 — DESIGN.md §3-1). 예전의
 * 14px · 400 은 58vh 칸 안에서 각주처럼 읽혔다. 번호는 오른쪽 예시의 몇 번째 상태인지를
 * 말한다 — 예전의 점은 그것을 말하지 못했다. **번호 칸의 기본 모양은 켜진 모양(채움)이다** —
 * 정적 렌더 · 감속 모션이 끝 상태를 본다. 지나온 · 아직 안 온 모양은 `is-live` 아래에서
 * `globals.css` 가 칠한다(`about-stage-*` 선택자 훅). 무대 밖에서는 아무 효과가 없다.
 */
function PointBody({ index, children }: { index: number; children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden
        className="about-stage-mark bg-brand-700 border-brand-700 text-fg-inverse text-body-2 grid size-8 shrink-0 place-items-center rounded-full border-2 font-semibold tabular-nums"
      >
        {index}
      </span>
      <p className="about-stage-text text-body-1 lg:text-title-2 text-fg pt-1 font-semibold break-keep lg:pt-0">
        {children}
      </p>
    </>
  )
}

/**
 * 고정 카드 위 맥락 줄 (#940, 1024 이상). 절 제목은 항목 2 부터 화면 밖이라 예시만 남는다 —
 * 표지어 · 제목을 카드 위에 한 줄로 남기고, 이 절에서 실제 기능으로 가는 바로가기를 붙여 둔다.
 *
 * **제목은 `aria-hidden` 이다** — 같은 절의 `h2` 를 되풀이한 것이다. 절 제목이 헤더 밑으로
 * 사라진 뒤에만 드러난다(`is-heading-gone`, `globals.css`). 바로가기는 1024 이상에서 이것
 * 하나다 — 항목 아래 것은 `lg:hidden` 이라 같은 링크가 두 번 읽히지 않는다.
 */
function StageContextRow({
  kicker,
  heading,
  href,
  link,
}: {
  kicker: string
  heading: string
  href: string
  link: string
}) {
  return (
    <>
      <p aria-hidden className="about-stage-context-title text-body-2 text-fg-muted font-semibold">
        <span className="text-link">{kicker}</span> · {heading}
      </p>
      <MoreLink href={href}>{link}</MoreLink>
    </>
  )
}

/**
 * 절 바로가기 — `--link`, 터치 영역 44. **문장 속 인라인 링크가 아니라 절의 액션이라
 * `text-body-1`(600)이다** (#940, DESIGN.md §3-1 예외 줄). 14px 일 때는 18px 항목 문장보다 작아
 * 위계가 뒤집혔다.
 */
function MoreLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'text-body-1 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-1 font-semibold focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      {children} <span aria-hidden>→</span>
    </Link>
  )
}

/** 규모 타일 — 중립 수치라 `--fg` 다. 등급 색을 쓰지 않는다 (§2-3) */
function ScaleTile({ value, label, delay = 0 }: { value: number; label: string; delay?: number }) {
  return (
    <Reveal delay={delay} className="bg-intro-tint rounded-lg p-4">
      <p className="text-display md:text-page text-fg font-black tabular-nums">
        <ScaleCount value={value} />
        {/* 단위는 2px 이 아니라 스케일 안의 4(`ml-1`)로 띄운다 — DESIGN.md §4 */}
        <span className="text-body-2 text-fg-muted ml-1 font-semibold">
          {messages.about.data.scaleUnit}
        </span>
      </p>
      <p className="text-caption text-fg-muted mt-1 font-semibold break-keep">{label}</p>
    </Reveal>
  )
}
