/**
 * 백엔드 공통 응답 래퍼.
 * 근거: backend/core/common-core Response<T> / DataHeader
 *       backend/docs/api-design-guide.md §2-1
 *       docs/api-integration-guide.md §2
 */
export type ApiResponse<T> = {
  dataHeader: {
    success: boolean
    resultCode: string | null
    /**
     * 사용자에게 보여줄 대표 메시지. **오류 종류와 무관하게 항상 문자열이다** (#491).
     * 예전에는 Bean Validation 실패에서만 `{ message, errors }` 객체가 왔는데, 그
     * 자리가 `fieldErrors` 로 분리되면서 이 필드는 문자열로 좁혀졌다.
     */
    resultMessage: string | null
    /**
     * 필드 단위 검증 오류. **검증 실패가 아니면 `null` 이다** (#491).
     * `toFormErrors()` 가 이것을 읽어 입력칸 밑 오류를 만든다 — docs/form-guide.md §4.1
     */
    fieldErrors?: ValidationErrorItem[] | null
  }
  dataBody: T | null
}

/**
 * 백엔드 `ValidationErrorItem` — 필드 하나의 검증 오류.
 *
 * `field` 는 백엔드가 필드를 특정하지 못하면 `request` 로 온다
 * (`ValidationErrorSupport.UNKNOWN_FIELD`) — 그때는 폼 전체 오류로 다룬다.
 */
export type ValidationErrorItem = {
  code: string
  field: string
  message: string
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

/**
 * 백엔드 `CodeNameDescriptionMetadata` — 여러 도메인이 공유하는 3필드 metadata.
 *
 * `EnumMetadata` 와 값 모양이 같지만 **`scoreDescription` 이 없다.** 점수 지표는
 * `ScoreMetricMetadata`(`types/insight.ts`)가 따로 담당한다.
 */
export type CodeNameMetadata = {
  code: string
  name: string
  description: string | null
}

/** XAI 추천 근거 */
export type Reason = EnumMetadata
