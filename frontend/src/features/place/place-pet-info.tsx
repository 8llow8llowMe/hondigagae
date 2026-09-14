import { CheckIcon } from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { messages } from '@/lib/messages'
import { petSizeVerdict } from '@/lib/place/pet-size'
import { toPlainText } from '@/lib/place/text'
import { withParenthesizedParticle, withTopicParticle } from '@/lib/text/korean'
import { cn } from '@/lib/utils/cn'
import type { EnumMetadata } from '@/types/api'
import type { PlacePetInfo } from '@/types/place'

/**
 * 반려견 동반 정보 — 아트보드 `장소 상세` 01·03 의 **체크 목록**과 04-① 의 정보 없음 상태.
 *
 * `dl` 나열이 아니라 체크 목록인 이유: 여기 담기는 것은 라벨-값 표가 아니라 **동반 조건
 * 문장**이다. 원문 라벨은 남기되(값만 두면 "유모차" 가 왜 적혀 있는지 알 수 없다) 각 줄이
 * 하나의 조건으로 읽히게 한다.
 *
 * 두 가지를 반드시 붙인다:
 *  1. **반려견을 대입한 줄** — "체중 제한" 을 옮기는 것과 "몽실이는 소형견이라 해당하지
 *     않아요" 까지 쓰는 것은 규정 전달과 판단 지원의 차이다 (아트보드 주석)
 *  2. **현장 확인 문구** — 동반 조건은 관광 API 값이라 최신이 아닐 수 있다. 이 줄이 없으면
 *     우리가 보증한 것으로 읽힌다
 */
export function PlacePetInfoSection({
  petInfo,
  allowance,
  sourceText,
  tel,
  petName,
  petSizeCode,
  petSizeName,
}: {
  /** **null 이어도 섹션을 숨기지 않는다** (아트보드 04-①) */
  petInfo: PlacePetInfo | null
  /**
   * 장소의 `petAllowanceType`. **`petInfo` 가 없을 때 무슨 말을 할지 이것이 정한다** —
   * 서버가 동반 여부를 등록해 둔 것과 아무것도 모르는 것은 다른 상태다.
   */
  allowance: EnumMetadata | null
  /** intro.chkPet — DTO 주석이 "판단은 petInfo 우선" 이라 참고 값으로만 둔다 */
  sourceText: string | null
  /** 정보가 없을 때 안내할 전화번호 */
  tel: string | null
  /** 선택된 반려견. null 이면 대입할 기준이 없어 그 줄을 렌더하지 않는다 */
  petName: string | null
  /** 판정용 code (`SMALL`/`MEDIUM`/`LARGE`) */
  petSizeCode: string | null
  /** 문장에 넣을 서버 `name`. FE 가 크기 한국어를 만들지 않는다 */
  petSizeName: string | null
}) {
  if (petInfo === null) return <EmptyPetInfo allowance={allowance} tel={tel} />

  const lines = petInfoLines(petInfo, sourceText)
  const verdict = sizeVerdictLine(petInfo, petName, petSizeCode, petSizeName)

  return (
    <div className="flex flex-col gap-4">
      {(lines.length > 0 || verdict !== null) && (
        /*
          2열은 폭이 있을 때만이다. 1024~1279 는 좌측 400 레일을 뺀 우측이 좁아 한 열로
          되돌린다 — 두 열로 두면 문장이 어절마다 끊긴다. 768~1023 은 한 컬럼이라 전폭이다.
        */
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-8 lg:grid-cols-1 xl:grid-cols-2">
          {lines.map((line) => (
            <PetInfoLine key={line.label} label={line.label} value={line.value} />
          ))}
          {verdict !== null && <PetInfoLine value={verdict} muted />}
        </ul>
      )}

      <p className="bg-band text-caption text-fg-muted rounded-md p-3 break-keep">
        {messages.place.detailPetInfoDisclaimer}
      </p>
    </div>
  )
}

function PetInfoLine({
  label,
  value,
  muted = false,
}: {
  label?: string
  value: string
  muted?: boolean
}) {
  return (
    <li className="flex items-start gap-2">
      {/*
        장식 아이콘이다 — 뜻은 옆 문장이 말한다 (DESIGN.md §9).

        **첫 글자 줄에 맞추는 보정을 두지 않는다** (#334). 20px 아이콘을 22px 줄(`body-2`)에
        맞추는 이상값은 1px 인데 그 값은 스페이싱 스케일에 없다 (§4) — 스케일 안 값 중
        0 이 1px, 4 가 3px 어긋나 가까운 쪽을 고른다.
      */}
      <CheckIcon size={20} aria-hidden className="text-metric-high-500 shrink-0" />
      <span className={cn('text-body-2 flex-1 break-keep', muted ? 'text-fg-muted' : 'text-fg')}>
        {label !== undefined && <span className="text-fg-muted">{label} </span>}
        {/* 개행이 있는 원문(etcAcmpyInfo)이 한 줄로 뭉치지 않게 한다 */}
        <span className="whitespace-pre-line">{value}</span>
      </span>
    </li>
  )
}

/** 아트보드 04-① — `petInfo` 가 비어도 섹션을 숨기지 않는다. 대신 다음 행동을 준다 */
/**
 * `petInfo` 가 없는 상태. **두 갈래다.**
 *
 * 서버가 동반 여부를 등록해 둔 곳(`ALLOWED`/`NOT_ALLOWED`/`PARTIALLY_ALLOWED`)에서
 * "동반 가능 여부가 등록되지 않았어요" 라고 말하면 제목 옆 배지와 **한 화면이 두 말을
 * 한다.** 명세는 모름을 확신처럼 말하지 말라고 했는데, 확신을 모름처럼 말하는 것도
 * 같은 크기의 거짓이다. 그래서 그 갈래에서는 **서버 문장을 그대로** 쓰고 없는 것이
 * 세부 조건임을 밝힌다 (FE 가 code 별 한국어를 만들지 않는다).
 */
function EmptyPetInfo({ allowance, tel }: { allowance: EnumMetadata | null; tel: string | null }) {
  const registered = allowance !== null && allowance.code !== 'UNKNOWN'

  return (
    <div className="flex flex-col items-start gap-2">
      {/* 점선 배지로 "모름" 을 드러낸다 — tint 를 주지 않는다 (DESIGN.md §2-3 UNKNOWN) */}
      {!registered && (
        <MetricBadge tone="unknown">{messages.place.detailPetInfoEmptyBadge}</MetricBadge>
      )}

      {registered && allowance.description !== null && allowance.description !== undefined && (
        <p className="text-body-2 text-fg break-keep">{allowance.description}</p>
      )}

      <p className="text-body-2 text-fg-muted break-keep">
        {registered
          ? messages.place.detailPetInfoDetailsMissingText
          : messages.place.detailPetInfoEmptyText}
      </p>
      {tel !== null && (
        <a
          href={`tel:${tel.replace(/[^\d+]/g, '')}`}
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.place.detailPetInfoEmptyTel.replace('{tel}', tel)}
        </a>
      )}
    </div>
  )
}

/**
 * 원문 9종을 화면 줄로 만든다. **값이 없는 줄은 만들지 않는다.**
 *
 * 순서는 "들어갈 수 있는가 → 무엇이 필요한가 → 무엇이 있는가" 다. 원문 필드 순서가 아니라
 * 방문자가 판단하는 순서다.
 */
export function petInfoLines(
  petInfo: PlacePetInfo,
  sourceText: string | null,
): { label: string; value: string }[] {
  const candidates: { label: string; value: string | null }[] = [
    /*
      가공값 2종을 맨 앞에 둔다 — "들어갈 수 있는가" 가 첫 질문이다.

      **`name` 이 아니라 `description` 을 쓴다.** `name`("일부 구역 동반 가능")은 이미 제목
      옆 배지가 말하고 있고, 여기서 필요한 것은 조건 문장이다. `description` 이 없으면
      `name` 으로 떨어진다 — 모르는 code 에서도 줄이 비지 않는다.
    */
    {
      label: messages.place.detailPetScope,
      value: petInfo.allowanceScope.description ?? petInfo.allowanceScope.name,
    },
    {
      label: messages.place.detailPetSize,
      value: petInfo.allowedPetSize.description ?? petInfo.allowedPetSize.name,
    },
    { label: messages.place.detailPetType, value: petInfo.acmpyTypeCd },
    { label: messages.place.detailPetAnimal, value: petInfo.acmpyPsblCpam },
    { label: messages.place.detailPetNeed, value: petInfo.acmpyNeedMtr },
    { label: messages.place.detailPetRisk, value: petInfo.relaAcdntRiskMtr },
    { label: messages.place.detailPetFacility, value: petInfo.relaPosesFclty },
    { label: messages.place.detailPetFurnished, value: petInfo.relaFrnshPrdlst },
    { label: messages.place.detailPetRental, value: petInfo.relaRntlPrdlst },
    { label: messages.place.detailPetPurchase, value: petInfo.relaPurcPrdlst },
    { label: messages.place.detailPetEtc, value: petInfo.etcAcmpyInfo },
    { label: messages.place.detailPetSourceText, value: sourceText },
  ]

  return candidates.flatMap((candidate) => {
    const text = toPlainText(candidate.value)
    return text === null ? [] : [{ label: candidate.label, value: text }]
  })
}

/**
 * 장소가 받아 주는 크기에 **선택된 반려견을 대입한** 한 줄.
 *
 * **`UNKNOWN` 을 "불가" 로 말하지 않는다** — 정보 없음을 단정하면 실제로는 갈 수 있는
 * 장소를 못 가는 곳으로 만든다 (backend `AllowedPetSize#allows` 와 같은 판단).
 */
export function sizeVerdictLine(
  petInfo: PlacePetInfo,
  petName: string | null,
  petSizeCode: string | null,
  petSizeName: string | null,
): string | null {
  // 기준이 되는 반려견이 없으면 대입할 것이 없다. 규정만 위 목록이 말한다
  if (petName === null) return null

  const verdict = petSizeVerdict(petInfo.allowedPetSize.code, petSizeCode)

  // 크기 이름은 **서버 metadata 의 name** 이다. FE 가 code 를 한국어로 번역하지 않는다
  if (verdict === 'unknown' || petSizeName === null) {
    return messages.place.detailPetSizeUnknown.replace('{name}', petName)
  }

  const template =
    verdict === 'allowed'
      ? messages.place.detailPetSizeAllowed
      : messages.place.detailPetSizeBlocked

  // 조사는 **괄호 안 크기 이름**의 받침을 본다 (`withParenthesizedParticle` 주석).
  // 판정 대상을 화제로 올리는 문장이라 주격(이/가)이 아니라 주제격(은/는)이다
  return template.replace(
    '{nameWithSize}',
    withParenthesizedParticle(petName, petSizeName, withTopicParticle),
  )
}
