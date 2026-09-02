/** 여러 마리의 이름을 한 줄로 잇는다 — 제목 기본값과 요약 줄이 함께 쓴다 (#128) */

/**
 * `몽실이·초코`.
 *
 * **조사를 여기서 붙이지 않는다.** `defaultPlanTitle` 이 쓰는
 * `withCompanionParticle` 은 **마지막 글자**의 받침을 보므로 이어붙인 문자열을 그대로
 * 넘기면 `몽실이·초코와` 가 나온다 — 조사 로직을 복제하지 않는다 (다견선택-세부명세 D5).
 *
 * 빈 이름은 건너뛴다. 스냅샷의 `name` 은 비어 있을 수 있고(옛 모양 승격),
 * 그대로 이으면 `몽실이·` 처럼 구분자만 남는다.
 */
export function petNamesLabel(pets: readonly { name: string }[]): string {
  return pets
    .map((pet) => pet.name.trim())
    .filter((name) => name !== '')
    .join('·')
}
