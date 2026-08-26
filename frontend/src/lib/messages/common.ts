/** 여러 화면이 공유하는 문구. 화면 고유 문구는 각 도메인 파일에 둔다 */
export const commonMessages = {
  retry: '다시 시도',
  loading: '불러오는 중',

  /** 5xx·무응답 */
  temporaryErrorTitle: '잠시 문제가 생겼어요',
  temporaryErrorDescription: '잠시 후 다시 시도해 주세요.',

  /** 400 */
  validationErrorTitle: '요청 조건이 올바르지 않습니다',

  /** 401 */
  unauthorizedTitle: '로그인이 필요합니다',
  unauthorizedDescription: '로그인 후 다시 이용해 주세요.',

  /** 403 등 */
  forbiddenTitle: '이용할 수 없는 요청입니다',

  listEnd: '마지막 장소까지 확인했어요',
  loadMore: '더 보기',
} as const
