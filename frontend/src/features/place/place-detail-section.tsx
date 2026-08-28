import Image from 'next/image'

import type { ReactNode } from 'react'

import { Badge } from '@/components/badge'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PlaceBackLink } from '@/features/place/place-back-link'
import { PlaceDetailSkeleton } from '@/features/place/place-detail-skeleton'
import { classify } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { isAllowedImageHost } from '@/lib/image/remote-host'
import { messages } from '@/lib/messages'
import { copyrightLabel } from '@/lib/place/copyright'
import { parseHomepage } from '@/lib/place/homepage'
import { toPlainText } from '@/lib/place/text'
import type { PlaceDetail, PlaceIntro, PlacePetInfo } from '@/types/place'

export type PlaceDetailSectionProps = {
  place: PlaceDetail | null
  loading: boolean
  /** 실패한 요청의 HTTP 상태. 성공이면 null */
  errorStatus: number | null
  /** 서버가 준 resultMessage (문자열이 아닐 수 있다) */
  errorMessage?: unknown
  onRetry: () => void
}

/**
 * 장소 상세의 4개 상태를 **배타적으로** 렌더한다.
 * props 로만 데이터를 받는 presentational 컴포넌트다 — node 환경에서 테스트하기 위해서다
 * (docs/testing-guide.md §1).
 *
 * **404 의 정상 경로는 여기가 아니다.** 서버 컴포넌트가 `notFound()` 로 보낸다.
 * 여기서 404 를 다루는 것은 클라이언트 재조회에서 리소스가 사라진 경우다.
 */
export function PlaceDetailSection({
  place,
  loading,
  errorStatus,
  errorMessage,
  onRetry,
}: PlaceDetailSectionProps) {
  if (loading) return <PlaceDetailSkeleton />

  if (errorStatus !== null) {
    const kind = classify(errorStatus)

    // 데이터 부재다. 재시도 버튼을 붙이지 않고 서버 문구를 그대로 노출한다
    if (kind === 'not-found') {
      return (
        <EmptyState
          title={toMessage(errorMessage, messages.place.detailNotFoundTitle)}
          description={messages.place.detailNotFoundDescription}
          action={<PlaceBackLink />}
        />
      )
    }

    // 컨트롤러가 @PathVariable long 이라 숫자가 아닌 placeId 는 404 가 아니라 400 이다.
    // 주소 자체가 잘못된 것이므로 재시도해도 같은 400 이다 — 재시도를 주지 않는다
    if (kind === 'validation') {
      return (
        <EmptyState
          title={messages.common.validationErrorTitle}
          description={toMessage(errorMessage, messages.place.detailNotFoundDescription)}
          action={<PlaceBackLink />}
        />
      )
    }

    // 5xx · 무응답 — 재시도를 제공한다
    return (
      <ErrorState
        title={messages.place.detailErrorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  if (place === null) return <PlaceDetailSkeleton />

  const overview = toPlainText(place.overview)
  const homepage = parseHomepage(place.homepage)
  const copyright = copyrightLabel(place.cpyrhtDivCd)
  const allowanceDescription = place.petAllowanceType.description ?? null

  return (
    <article className="flex flex-col gap-8">
      <HeroImage title={place.title} url={place.firstImage} />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone="neutral" size="sm">
            {place.contentType.name}
          </Badge>
          <Badge tone="neutral" size="sm">
            {place.petAllowanceType.name}
          </Badge>
        </div>

        {/* 공백 없는 긴 장소명이 가로로 넘치지 않게 한다 (styling-guide.md §4) */}
        <h1 className="text-display text-fg font-extrabold break-words">{place.title}</h1>

        {allowanceDescription !== null && (
          <p className="text-body-2 text-fg-muted">{allowanceDescription}</p>
        )}
      </header>

      <div className="border-border border-y py-4">
        <dl className="flex flex-col gap-3">
          <InfoRow label={messages.place.detailAddress} value={fullAddress(place)} />
          <InfoRow label={messages.place.detailTel} value={place.tel}>
            {place.tel !== null && <TelLink tel={place.tel} />}
          </InfoRow>
          <InfoRow label={messages.place.detailHomepage} value={homepage?.label ?? null}>
            {homepage !== null && <HomepageLink href={homepage.href} label={homepage.label} />}
          </InfoRow>
        </dl>
      </div>

      {/* nullable 은 에러가 아니라 숨김이다 */}
      {overview !== null && (
        <Section title={messages.place.detailSectionOverview}>
          <p className="text-body-1 text-fg whitespace-pre-line">{overview}</p>
        </Section>
      )}

      {hasIntroValue(place.intro) && <IntroSection intro={place.intro} />}

      {place.petInfo !== null && (
        <PetInfoSection petInfo={place.petInfo} sourceText={place.intro?.chkPet ?? null} />
      )}

      {place.images.length > 0 && (
        <Section title={messages.place.detailSectionImages}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {place.images.map((image, index) => (
              <li
                key={image.originImgUrl ?? index}
                className="bg-band relative aspect-square overflow-hidden rounded-md"
              >
                {isAllowedImageHost(image.originImgUrl) && image.originImgUrl !== null ? (
                  <Image
                    src={image.originImgUrl}
                    alt={image.imgName ?? ''}
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-caption text-fg-muted absolute inset-0 flex items-center justify-center">
                    {messages.place.noImage}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {copyright !== null && (
        <p className="text-caption text-fg-muted">
          {messages.place.detailCopyrightPrefix} · {copyright}
        </p>
      )}
    </article>
  )
}

function IntroSection({ intro }: { intro: PlaceIntro }) {
  return (
    <Section title={messages.place.detailSectionIntro}>
      <dl className="flex flex-col gap-3">
        <InfoRow label={messages.place.detailInfoCenter} value={intro.infoCenter} />
        <InfoRow label={messages.place.detailUseTime} value={intro.useTime} />
        <InfoRow label={messages.place.detailRestDate} value={intro.restDate} />
        <InfoRow label={messages.place.detailParking} value={intro.parking} />
        <InfoRow label={messages.place.detailBabyCarriage} value={intro.chkBabyCarriage} />
        <InfoRow label={messages.place.detailCreditCard} value={intro.chkCreditCard} />
      </dl>
    </Section>
  )
}

function PetInfoSection({
  petInfo,
  sourceText,
}: {
  petInfo: PlacePetInfo
  /** intro.chkPet — DTO 주석이 "판단은 petInfo 우선" 이라 참고 값으로만 둔다 */
  sourceText: string | null
}) {
  const scopeDescription = petInfo.allowanceScope.description ?? null

  return (
    <Section title={messages.place.detailSectionPet}>
      {/* 색만으로 정보를 전달하지 않는다 — 서버 name 텍스트를 함께 쓴다 (styling-guide.md §6) */}
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Badge tone="neutral">{petInfo.allowanceScope.name}</Badge>
        <Badge tone="neutral">{petInfo.allowedPetSize.name}</Badge>
        {petInfo.leashRequired && (
          <Badge tone="neutral">{messages.place.detailLeashRequired}</Badge>
        )}
      </div>

      {scopeDescription !== null && (
        <p className="text-body-2 text-fg-muted mb-4">{scopeDescription}</p>
      )}

      <dl className="flex flex-col gap-3">
        <InfoRow label={messages.place.detailPetType} value={petInfo.acmpyTypeCd} />
        <InfoRow label={messages.place.detailPetAnimal} value={petInfo.acmpyPsblCpam} />
        <InfoRow label={messages.place.detailPetNeed} value={petInfo.acmpyNeedMtr} />
        <InfoRow label={messages.place.detailPetEtc} value={petInfo.etcAcmpyInfo} />
        <InfoRow label={messages.place.detailPetRisk} value={petInfo.relaAcdntRiskMtr} />
        <InfoRow label={messages.place.detailPetFacility} value={petInfo.relaPosesFclty} />
        <InfoRow label={messages.place.detailPetFurnished} value={petInfo.relaFrnshPrdlst} />
        <InfoRow label={messages.place.detailPetPurchase} value={petInfo.relaPurcPrdlst} />
        <InfoRow label={messages.place.detailPetRental} value={petInfo.relaRntlPrdlst} />
        <InfoRow label={messages.place.detailPetSourceText} value={sourceText} />
      </dl>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title-1 text-fg font-bold">{title}</h2>
      {children}
    </section>
  )
}

/**
 * 값이 없으면 줄 자체를 렌더하지 않는다.
 * `children` 을 주면 값 대신 그것을 렌더한다 (링크가 필요한 줄).
 */
function InfoRow({
  label,
  value,
  children,
}: {
  label: string
  value: string | null
  children?: ReactNode
}) {
  const text = toPlainText(value)
  if (text === null) return null

  return (
    <div className="flex flex-col gap-1 md:flex-row md:gap-4">
      <dt className="text-caption text-fg-muted md:w-28 md:shrink-0">{label}</dt>
      {/* 개행이 있는 원문(etcAcmpyInfo)이 한 줄로 뭉치지 않게 한다 */}
      <dd className="text-body-2 text-fg whitespace-pre-line">{children ?? text}</dd>
    </div>
  )
}

function HeroImage({ title, url }: { title: string; url: string | null }) {
  const usable = isAllowedImageHost(url) && url !== null

  return (
    <div className="bg-band relative aspect-video w-full overflow-hidden rounded-md">
      {usable ? (
        // 대표 이미지는 장식이 아니라 콘텐츠다 — 장소명을 alt 로 준다
        <Image
          src={url}
          alt={title}
          fill
          sizes="(min-width: 768px) 768px, 100vw"
          priority
          className="object-cover"
        />
      ) : (
        <span className="text-body-2 text-fg-muted absolute inset-0 flex items-center justify-center">
          {messages.place.noImage}
        </span>
      )}
    </div>
  )
}

function TelLink({ tel }: { tel: string }) {
  return (
    <a
      href={`tel:${tel.replace(/[^\d+]/g, '')}`}
      className="text-link hover:text-link-hover focus-visible:ring-brand-500 rounded-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
    >
      {tel}
    </a>
  )
}

function HomepageLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      // 원문이 외부 링크다. opener 를 넘기지 않는다
      rel="noopener noreferrer"
      className="text-link hover:text-link-hover focus-visible:ring-brand-500 rounded-sm font-semibold break-all focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
    </a>
  )
}

/** `addr2` 는 `addr1` 이 있을 때만 뒤에 붙인다 */
function fullAddress(place: PlaceDetail): string | null {
  if (place.addr1 === null) return null
  return place.addr2 === null ? place.addr1 : `${place.addr1} ${place.addr2}`
}

/** 객체는 있는데 안이 전부 비어 있으면 섹션을 만들지 않는다 */
function hasIntroValue(intro: PlaceIntro | null): intro is PlaceIntro {
  if (intro === null) return false

  return [
    intro.infoCenter,
    intro.useTime,
    intro.restDate,
    intro.parking,
    intro.chkBabyCarriage,
    intro.chkCreditCard,
  ].some((value) => toPlainText(value) !== null)
}
