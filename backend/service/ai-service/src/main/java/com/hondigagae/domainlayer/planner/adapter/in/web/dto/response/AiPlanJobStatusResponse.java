package com.hondigagae.domainlayer.planner.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 여행 일정 생성 작업 상태 응답 DTO")
public record AiPlanJobStatusResponse(

    @Schema(description = "작업 식별자 (UUID). 제출 응답의 jobId 와 같다", example = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00")
    String jobId,

    @Schema(description = "작업 상태 메타데이터. code 는 PENDING 대기 중 · RUNNING 생성 중 · COMPLETED 완료 · FAILED 실패 · CANCELED 취소됨",
        example = "{\"code\":\"COMPLETED\",\"name\":\"완료\",\"description\":\"여행 일정 생성이 완료되었습니다.\"}")
    CodeNameDescriptionMetadata status,

    @Schema(description = "지금 밟고 있는 세부 단계 metadata. code 는 CONDITIONS 조건 확인 · CANDIDATES 후보 장소 수집 · "
        + "WEATHER 날씨 전망 반영 · DRAFTING 일정 구성. "
        + "**PENDING 이면 null 이다** — 아직 시작하지 않았다는 뜻이라 0 이나 1 로 그리면 안 된다. "
        + "종결 상태에서는 마지막으로 밟은 단계가 남는다(실패 지점)",
        nullable = true)
    CodeNameDescriptionMetadata step,

    @Schema(description = "몇 번째 단계인지 (1부터). PENDING 이면 null", example = "3", nullable = true)
    Integer stepOrder,

    @Schema(description = "전체 단계 수. 화면의 \"n / m 단계\" 에서 m 이다. 단계가 늘면 이 값도 함께 늘어난다", example = "4")
    int totalSteps,

    @Schema(description = "생성된 일정 초안. status=COMPLETED 일 때만 채워지고 그 외에는 null", nullable = true)
    AiPlanDraftResponse planDraft,

    @Schema(description = "실패 사유 코드. status=FAILED 일 때만 채워지고 그 외에는 null", example = "AIPLAN_005", nullable = true)
    String errorCode,

    @Schema(description = "실패 사유 메시지. status=FAILED 일 때만 채워지고 그 외에는 null",
        example = "AI 일정 생성 작업이 실패했습니다.", nullable = true)
    String errorMessage
) {

}
