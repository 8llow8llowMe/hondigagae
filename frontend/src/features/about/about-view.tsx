import Link from 'next/link'

import type { ReactNode } from 'react'

import { BrandSymbol } from '@/components/brand/symbol'
import { Wordmark } from '@/components/brand/wordmark'
import { ButtonLink } from '@/components/button'
import { ChevronRightIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { Surface, SurfaceList } from '@/components/surface'
import {
  EMERGENCY_ROWS_SPECIMEN,
  INDOOR_SPECIMEN,
  PLACE_ROWS_SPECIMEN,
  SCALE_SPECIMEN,
  SUITABILITY_SPECIMEN,
  WEATHER_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { CongestionSpecimen } from '@/features/about/congestion-specimen'
import { GoldenCurveSpecimen } from '@/features/about/golden-curve-specimen'
import { IntroBand } from '@/features/about/intro-band'
import { PlanSpecimen } from '@/features/about/plan-specimen'
import { Reveal } from '@/features/about/reveal'
import { VerdictSpecimen } from '@/features/about/verdict-specimen'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 서비스 소개 — `/about` (#611 → #635).
 *
 * **서버 컴포넌트다.** 세션도 프리페치도 없고 백엔드를 부르지 않는다. 클라이언트 경계는
 * `Reveal` 과 예시 4개뿐이다 (명세 §6-4).
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
 * **2단 배치는 12열 그리드 위에 세운다.** `grid-cols-[minmax(0,1fr)_400px]` 같은 arbitrary
 * 값은 lint 가 막는다 — 괄호가 든 arbitrary 를 Tailwind 가 조용히 무시하는 사고가 있었다
 * (`eslint.config.mjs` `noComplexArbitrary`). 히어로는 3열 중 2열이 카피, 질문 절은 12열 중
 * 5:7 이다.
 */
export function AboutView() {
  const about = messages.about

  return (
    <>
      {/* ── 1. 히어로 ── */}
      <IntroBand
        tone="brand"
        labelledBy="about-hero-heading"
        className="grid gap-8 lg:grid-cols-3 lg:items-center lg:gap-16"
      >
        <div className="lg:col-span-2">
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
          <h1
            id="about-hero-heading"
            className="text-display md:text-page mt-3 font-extrabold break-keep"
          >
            {about.hero.heading}
          </h1>
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
        </div>
        <VerdictSpecimen />
      </IntroBand>

      {/* ── 2. 데려가도 돼요? ── */}
      <IntroBand
        tone="plain"
        labelledBy="about-q1-heading"
        className="lg:grid lg:grid-cols-12 lg:gap-10"
      >
        <QuestionCopy
          id="about-q1-heading"
          className="lg:col-span-5"
          kicker={about.q1.kicker}
          heading={about.q1.heading}
          lead={about.q1.lead}
          points={about.q1.points}
          href="/places"
          link={about.q1.link}
        />
        <Reveal className="mt-6 lg:col-span-7 lg:mt-0">
          <Surface aria-label={about.specimen.placesAria} className="-mx-4 md:mx-0">
            <div className={cn('flex flex-wrap gap-1.5 pt-4', INSET_CLASS.card)}>
              <span className="bg-fg text-fg-inverse text-caption inline-flex h-7 items-center rounded-full px-3 font-semibold">
                {about.specimen.placesChip}
              </span>
              <span className="border-border-strong text-caption text-fg inline-flex h-7 items-center rounded-full border px-3 font-semibold">
                실내
              </span>
              <span className="border-border-strong text-caption text-fg inline-flex h-7 items-center rounded-full border px-3 font-semibold">
                운영 중
              </span>
            </div>
            <ul className={cn('pt-3 pb-4', INSET_CLASS.card)}>
              {PLACE_ROWS_SPECIMEN.map((row, index) => (
                <li
                  key={row.name}
                  className={cn(
                    'flex items-center gap-3 py-3',
                    index > 0 && 'border-border border-t',
                  )}
                >
                  <span aria-hidden className="bg-band size-12 shrink-0 rounded-md" />
                  <div>
                    <p className="text-body-1 text-fg">{row.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {'unknown' in row && (
                        <span className="border-metric-unknown-500 text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm border border-dashed px-2 font-medium">
                          {about.specimen.unknownTag}
                        </span>
                      )}
                      {row.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-band text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm px-2 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                      {'open' in row && (
                        <span className="bg-status-open-100 text-status-open-700 text-caption inline-flex h-5.5 items-center rounded-sm px-2 font-semibold">
                          운영 중
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className={cn('text-caption text-fg-muted pb-4 font-medium', INSET_CLASS.card)}>
              {about.specimen.placesNote}
            </p>
          </Surface>
        </Reveal>
      </IntroBand>

      {/* ── 3. 지금 나가도 돼요? ── */}
      <IntroBand
        tone="tint"
        labelledBy="about-q2-heading"
        className="lg:grid lg:grid-cols-12 lg:gap-10"
      >
        <QuestionCopy
          id="about-q2-heading"
          className="lg:col-span-5"
          kicker={about.q2.kicker}
          heading={about.q2.heading}
          lead={about.q2.lead}
          points={about.q2.points}
          href="/"
          link={about.q2.link}
        />
        <Reveal className="mt-6 lg:col-span-7 lg:mt-0">
          <GoldenCurveSpecimen />
        </Reveal>
      </IntroBand>

      {/* ── 4. 오늘 어디 가요? ── */}
      <IntroBand tone="plain" labelledBy="about-q3-heading">
        <QuestionCopy
          id="about-q3-heading"
          kicker={about.q3.kicker}
          heading={about.q3.heading}
          lead={about.q3.lead}
        />
        <div className="mt-6 grid gap-2 md:grid-cols-2 md:gap-6">
          <Reveal>
            <FeatureCard
              title={about.q3.cards.suitability.title}
              desc={about.q3.cards.suitability.desc}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-1 text-fg">{SUITABILITY_SPECIMEN.place}</p>
                <MetricBadge tone="high">{about.specimen.suitabilityGrade}</MetricBadge>
              </div>
              <ul className="mt-3 grid gap-2">
                {about.specimen.suitabilityReasons.map((reason) => (
                  <li key={reason} className="text-body-2 text-fg flex gap-2">
                    <span aria-hidden className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full" />
                    {reason}
                  </li>
                ))}
              </ul>
            </FeatureCard>
          </Reveal>
          <Reveal delay={60}>
            <FeatureCard
              title={about.q3.cards.congestion.title}
              desc={about.q3.cards.congestion.desc}
            >
              <CongestionSpecimen />
            </FeatureCard>
          </Reveal>
          <Reveal delay={120}>
            <FeatureCard
              title={about.q3.cards.aiPlan.title}
              tag={about.specimen.planAiTag}
              desc={about.q3.cards.aiPlan.desc}
            >
              <PlanSpecimen />
            </FeatureCard>
          </Reveal>
          <Reveal delay={180}>
            <FeatureCard title={about.q3.cards.indoor.title} desc={about.q3.cards.indoor.desc}>
              <div role="img" aria-label={about.specimen.weatherAria} className="flex gap-2">
                {WEATHER_SPECIMEN.map((day) => (
                  <div key={day.day} className="bg-band flex-1 rounded-md p-2 text-center">
                    <p className="text-caption text-fg-muted font-semibold">{day.day}</p>
                    <p className="text-title-2 leading-7">{day.icon}</p>
                    <p className="text-caption text-fg font-semibold">{day.temp}</p>
                  </div>
                ))}
              </div>
              <p className="text-body-2 text-fg mt-3 font-semibold">{about.specimen.indoorTitle}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {INDOOR_SPECIMEN.map((item) => (
                  <span
                    key={item}
                    className="bg-band text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm px-2 font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </FeatureCard>
          </Reveal>
        </div>
        <MoreLink href="/ai-plans/new" className="mt-6">
          {about.q3.link}
        </MoreLink>
      </IntroBand>

      {/* ── 5. 위급하면? ── */}
      <IntroBand
        tone="tint"
        labelledBy="about-q4-heading"
        className="lg:grid lg:grid-cols-12 lg:gap-10"
      >
        <QuestionCopy
          id="about-q4-heading"
          className="lg:col-span-5"
          kicker={about.q4.kicker}
          heading={about.q4.heading}
          lead={about.q4.lead}
          points={about.q4.points}
          href="/emergency"
          link={about.q4.link}
        />
        <Reveal className="mt-6 lg:col-span-7 lg:mt-0">
          <Surface aria-label={about.specimen.emergencyAria} className="-mx-4 md:mx-0">
            <div className={cn('pt-4', INSET_CLASS.card)}>
              <p className="text-title-2 text-fg font-semibold">{about.specimen.emergencyTitle}</p>
              <p className="text-caption text-fg-muted mt-1 font-medium">
                {about.specimen.emergencySub}
              </p>
            </div>
            <ul className={cn('pt-3', INSET_CLASS.card)}>
              {EMERGENCY_ROWS_SPECIMEN.map((row, index) => (
                <li
                  key={row.name}
                  className={cn(
                    'flex items-center gap-3 py-3',
                    index > 0 && 'border-border border-t',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-body-1 text-fg">{row.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="bg-status-open-100 text-status-open-700 text-caption inline-flex h-5.5 items-center rounded-sm px-2 font-semibold">
                        {row.status}
                      </span>
                      <span className="bg-band text-caption text-fg-muted inline-flex h-5.5 items-center rounded-sm px-2 font-medium">
                        {row.kind}
                      </span>
                    </div>
                  </div>
                  <span className="text-body-2 text-fg shrink-0 font-semibold tabular-nums">
                    {row.distance}
                  </span>
                </li>
              ))}
            </ul>
            <p className={cn('text-caption text-fg-muted pt-3 pb-4 font-medium', INSET_CLASS.card)}>
              {about.specimen.emergencyNote}
            </p>
          </Surface>
        </Reveal>
      </IntroBand>

      {/* ── 6. 무엇을 보고 판단하나요 (+ 7. 알아두실 점) ── */}
      <IntroBand tone="plain" labelledBy="about-data-heading">
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
            className="mt-2 -mx-4 md:mx-0"
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

      {/* ── 8. 마무리 CTA ── */}
      <IntroBand tone="brand" labelledBy="about-cta-heading" className="grid gap-5">
        <div>
          <h2
            id="about-cta-heading"
            className="text-title-1 lg:text-display font-bold break-keep lg:font-extrabold"
          >
            {about.cta.heading}
          </h2>
          <p className="text-body-1 mt-2 font-normal break-keep opacity-90">{about.cta.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/" variant="inverse">
            {about.cta.primary}
          </ButtonLink>
          <ButtonLink href="/pets/new" variant="inverseOutline">
            {about.cta.secondary}
          </ButtonLink>
        </div>
      </IntroBand>
    </>
  )
}

/** 절 머리 — 표지어 · h2 · 리드 · (항목 · 링크). `points` 항목마다 `Reveal` 로 60ms 씩 등장 */
function QuestionCopy({
  id,
  className,
  kicker,
  heading,
  lead,
  points,
  href,
  link,
}: {
  id: string
  className?: string
  kicker: string
  heading: string
  lead: string
  points?: readonly string[]
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
        <ul className="mt-5 grid gap-3">
          {points.map((point, index) => (
            <li key={point}>
              <Reveal delay={index * 60} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-intro-tint text-brand-700 grid size-7 shrink-0 place-items-center rounded-md"
                >
                  <span className="bg-brand-700 size-1.5 rounded-full" />
                </span>
                <p className="text-body-2 text-fg pt-1 break-keep">{point}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      )}
      {href !== undefined && link !== undefined && (
        <MoreLink href={href} className="mt-3">
          {link}
        </MoreLink>
      )}
    </div>
  )
}

/** 인라인 액션 링크 — `--link`, 터치 영역 44 */
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
        'text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-1 font-semibold focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      {children} <span aria-hidden>→</span>
    </Link>
  )
}

/** 질문 3 의 하위 카드 — 제목(h3) · 설명 · 예시 블록. `Surface` 는 h2 를 그리므로 여기서는 제목 없이 쓰고 h3 를 직접 둔다 */
function FeatureCard({
  title,
  tag,
  desc,
  children,
}: {
  title: string
  tag?: string
  desc: string
  children: ReactNode
}) {
  return (
    <Surface className="-mx-4 h-full md:mx-0">
      <div className={cn('pt-4 pb-4', INSET_CLASS.card)}>
        <h3 className="text-title-2 text-fg font-semibold">
          {title}
          {tag !== undefined && (
            <span className="text-caption text-fg-muted ml-1.5 font-semibold">· {tag}</span>
          )}
        </h3>
        <p className="text-body-2 text-fg-muted mt-1 break-keep">{desc}</p>
        <div className="border-border mt-4 border-t pt-3">{children}</div>
      </div>
    </Surface>
  )
}

/** 규모 타일 — 중립 수치라 `--fg` 다. 등급 색을 쓰지 않는다 (§2-3) */
function ScaleTile({ value, label, delay = 0 }: { value: number; label: string; delay?: number }) {
  return (
    <Reveal delay={delay} className="bg-intro-tint rounded-lg p-4">
      <p className="text-display md:text-page text-fg font-black tabular-nums">
        {value}
        {/* 단위는 2px 이 아니라 스케일 안의 4(`ml-1`)로 띄운다 — DESIGN.md §4 */}
        <span className="text-body-2 text-fg-muted ml-1 font-semibold">
          {messages.about.data.scaleUnit}
        </span>
      </p>
      <p className="text-caption text-fg-muted mt-1 font-semibold break-keep">{label}</p>
    </Reveal>
  )
}
