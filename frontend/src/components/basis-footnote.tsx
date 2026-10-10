import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 체감온도 근거 문장에 붙는 각주 — **계산 입력과 출처** (#317).
 *
 * `GET /places/{id}/walk-safety` 응답에서 **자리를 못 정한 채 남아 있던 필드 둘**이다.
 * 나머지는 #312 · #313 · #314 로 갔고 이 둘만 남았다.
 *
 * | 필드 | 성격 |
 * |------|------|
 * | `weatherProviderName` | **출처** — 이 판정이 무엇에 기대고 있는지 |
 * | `humidity` | **계산 입력** — 체감온도가 기온 + 상대습도로 나온다 |
 *
 * **새 줄을 만들지 않는다.** 홈 첫 화면에 이미 숫자값이 빽빽하다 — 상시 노출로 더하면
 * 밀도 문제를 키우면서 정작 행동은 하나도 바꾸지 않는다. 그래서 이 각주는 근거를 **여는
 * 자리 안에서만** 산다: 홈은 `InfoTip` 말풍선, 장소 상세는 `체감온도 계산 근거` 서랍.
 *
 * **한 줄이다.** 둘을 각각의 줄로 세우면 말풍선 안에서도 목록이 되고, 그러면 근거 문장이
 * 아니라 표를 읽게 된다.
 *
 * **`null` 은 그 조각만 뺀다.** 출처가 없어도 근거 문장은 성립하고, 습도가 없는 시각은
 * 서버가 기온을 그대로 쓴다고 `feelsLikeBasis` 가 이미 말한다. 둘 다 없으면 각주 자체가
 * 없다 — 빈 줄을 남기지 않는다.
 */
export function BasisFootnote({
  humidity,
  providerName,
  className,
}: {
  humidity: number | null
  providerName: string | null
  className?: string
}) {
  const parts = [
    humidity === null
      ? null
      : messages.common.feelsLikeHumidity.replace('{value}', String(humidity)),
    providerName === null || providerName === ''
      ? null
      : messages.common.feelsLikeProvider.replace('{name}', providerName),
  ].filter((part): part is string => part !== null)

  if (parts.length === 0) return null

  return (
    <p className={cn('text-caption text-fg-muted font-medium', className)}>{parts.join(' · ')}</p>
  )
}
