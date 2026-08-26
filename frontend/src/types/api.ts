/**
 * 백엔드 공통 응답 래퍼.
 * 근거: backend/core/common-core Response<T> / DataHeader
 *       docs/api-integration-guide.md §2
 */
export type ApiResponse<T> = {
  dataHeader: {
    success: boolean
    resultCode: string | null
    /** 백엔드 타입이 Object 다. Bean Validation 실패 시 필드별 구조가 온다 — string 으로 좁히지 않는다 */
    resultMessage: unknown
  }
  dataBody: T | null
}

/** 커서 기반 목록. `content`(단수)나 totalPages 는 없다 — docs/api-integration-guide.md §4 */
export type SliceResponse<T> = {
  contents: T[]
  hasNext: boolean
}

/**
 * 서버가 표시 문구까지 내려주는 enum metadata.
 * FE는 name / description 을 그대로 렌더한다. 한국어 매핑 테이블을 만들지 않는다
 * (docs/api-integration-guide.md §6).
 */
export type EnumMetadata = {
  code: string
  name: string
  description?: string | null
  scoreDescription?: string | null
}

/** XAI 추천 근거 */
export type Reason = EnumMetadata
