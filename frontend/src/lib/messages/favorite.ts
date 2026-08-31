/**
 * 저장(즐겨찾기) 문구 — 아트보드 `혼디가개 장소 상세` 01·03 하단 바.
 *
 * **"찜" 이 아니라 "저장" 이다.** 아트보드가 `aria-label="저장"` / `aria-label="저장 해제"`
 * 로 못박았고, 백엔드 도메인명(favorite)을 화면 문구로 끌어오지 않는다.
 */
export const favoriteMessages = {
  /** `aria-pressed=false` 일 때의 이름 */
  save: '저장',
  /** `aria-pressed=true` 일 때의 이름. 같은 버튼이 하는 일이 반대가 된다 */
  unsave: '저장 해제',

  saveToast: '저장했어요',
  unsaveToast: '저장을 해제했어요',

  errorTitle: '저장하지 못했어요',
  errorDescription: '잠시 후 다시 시도해 주세요.',
  /** `FAVORITE_002` — 상한이라 재시도로 풀리지 않는다. 무엇을 해야 하는지 말한다 */
  limitError: '저장은 {max}곳까지예요. 마이페이지에서 저장한 장소를 정리한 뒤 다시 시도해 주세요.',
  /** `FAVORITE_001` — 원천에서 사라진 장소다. 재시도로 풀리지 않는다 */
  missingPlaceError: '지금은 저장할 수 없는 장소예요. 정보가 정리 중이거나 안내가 내려간 곳이에요.',

  /** 미로그인 시트 — 아트보드 04 ④ 와 같은 형식이되 담기가 아니라 저장이다 */
  loginTitle: '장소를 저장하려면 로그인이 필요해요',
  /** `{title}` 에는 조사를 붙인 이름이 들어간다 — `withObjectParticle()` (을/를이 갈린다) */
  loginDescription: '로그인하면 {title} 저장할 수 있어요. 지금 보던 화면으로 돌아와요.',
} as const
