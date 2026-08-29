import { ALLOWED_PET_SIZE_CODES, type AllowedPetSizeCode } from '@/types/place'

/**
 * 장소가 받아 주는 크기(`AllowedPetSize`)와 실제 반려견 크기(`PetSizeType`)를 맞대 본다.
 *
 * backend `shared-travel` 의 `AllowedPetSize#allows(PetSizeType)` 이식이다. **규칙을 여러
 * 곳에 복사하지 않는다** — "소형견만 가능" 을 어디서는 중형견까지 통과시키는 일이 생긴다
 * (백엔드 enum 주석이 같은 이유를 적어 두고 있다).
 */

/**
 * 이 장소가 해당 크기를 받아 주는지. **`UNKNOWN` 은 `true` 다.**
 *
 * 정보 없음을 "불가" 로 단정하면 실제로는 갈 수 있는 장소가 검색에서 사라진다.
 * 문화정보원 원천에 크기 정보가 없는 곳이 흔하다.
 */
export function allowsPetSize(allowedPetSize: string, petSizeType: string | null): boolean {
  if (petSizeType === null) return true

  switch (allowedPetSize) {
    case 'SMALL_ONLY':
      return petSizeType === 'SMALL'
    case 'SMALL_MEDIUM':
      return petSizeType !== 'LARGE'
    default:
      // ALL · UNKNOWN — 백엔드와 같이 통과시킨다
      return true
  }
}

/**
 * 화면에 문장으로 쓸 판정. **`allowsPetSize` 와 결과 축이 다르다.**
 *
 * 통과 여부는 `UNKNOWN` 도 `true` 지만, 화면에서는 "들어갈 수 있어요" 와 "판단할 수
 * 없어요" 를 같은 문장으로 말할 수 없다. 모름을 확신처럼 말하면 그 문장이 거짓이 된다.
 */
export type PetSizeVerdict = 'allowed' | 'blocked' | 'unknown'

export function petSizeVerdict(allowedPetSize: string, petSizeType: string | null): PetSizeVerdict {
  // 기준이 되는 반려견이 없으면 대입할 것이 없다
  if (petSizeType === null) return 'unknown'
  // 모르는 code 를 통과로 읽지 않는다 — 계약이 늘어나면 여기서 드러난다
  if (!isAllowedPetSizeCode(allowedPetSize)) return 'unknown'
  if (allowedPetSize === 'UNKNOWN') return 'unknown'

  return allowsPetSize(allowedPetSize, petSizeType) ? 'allowed' : 'blocked'
}

function isAllowedPetSizeCode(code: string): code is AllowedPetSizeCode {
  return (ALLOWED_PET_SIZE_CODES as readonly string[]).includes(code)
}
