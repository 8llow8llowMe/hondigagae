package com.hondigagae.domainlayer.planner.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 여행 일정 생성 작업 상태 응답 DTO")
public record AiPlanJobStatusResponse(

    @Schema(description = "작업 식별자 (UUID). 제출 응답의 jobId 와 같다", example = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00")
    String jobId,

    @Schema(description = "작업 상태 메타데이터. code 는 PENDING 대기 중 · RUNNING 생성 중 · COMPLETED 완료 · FAILED 실패",
        example = "{\"code\":\"COMPLETED\",\"name\":\"완료\",\"description\":\"여행 일정 생성이 완료되었습니다.\"}")
    CodeNameDescriptionMetadata status,

    @Schema(description = "생성된 일정 초안. status=COMPLETED 일 때만 채워지고 그 외에는 null", nullable = true)
    AiPlanDraftResponse planDraft,

    @Schema(description = "실패 사유 코드. status=FAILED 일 때만 채워지고 그 외에는 null", example = "AIPLAN_005", nullable = true)
    String errorCode,

    @Schema(description = "실패 사유 메시지. status=FAILED 일 때만 채워지고 그 외에는 null",
        example = "AI 일정 생성 작업이 실패했습니다.", nullable = true)
    String errorMessage
) {

}
