package com.hondigagae.domainlayer.planner.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 여행 일정 생성 제출 응답 DTO. 작업 접수 시 202와 함께 jobId를 반환한다.")
public record AiPlanSubmitResponse(

    @Schema(description = "제출 상태 메타데이터. code 는 ACCEPTED 작업 접수됨 하나다",
        example = "{\"code\":\"ACCEPTED\",\"name\":\"작업 접수됨\",\"description\":\"일정 생성 작업이 접수되었습니다. 작업 상태 조회 API로 완료 여부를 확인해 주세요.\"}")
    CodeNameDescriptionMetadata submissionStatus,

    @Schema(description = "작업 식별자 (UUID). 작업 상태 조회·SSE 스트림의 경로 변수 jobId 로 그대로 쓴다",
        example = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00")
    String jobId
) {

}
