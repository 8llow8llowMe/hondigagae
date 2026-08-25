package com.hondigagae.domainlayer.planner.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 여행 일정 생성 작업 상태 응답 DTO")
public record AiPlanJobStatusResponse(

    @Schema(description = "작업 식별자", example = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00")
    String jobId,

    @Schema(description = "작업 상태 메타데이터",
        example = "{\"code\":\"COMPLETED\",\"name\":\"완료\",\"description\":\"여행 일정 생성이 완료되었습니다.\"}")
    CodeNameDescriptionMetadata status,

    @Schema(description = "생성된 일정 초안 (status=COMPLETED 일 때만 채워짐)")
    AiPlanDraftResponse planDraft,

    @Schema(description = "실패 사유 코드 (status=FAILED 일 때만 채워짐)", example = "AIPLAN_005")
    String errorCode,

    @Schema(description = "실패 사유 메시지 (status=FAILED 일 때만 채워짐)")
    String errorMessage
) {

}
