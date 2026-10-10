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

    @Schema(description = "현재 단계에 들어간 서버 시각 (ISO-8601, 서비스 기준 시간대 Asia/Seoul 오프셋 포함, 밀리초까지). "
        + "이 단계에서 경과 시간을 그릴 때 쓴다. 지어낸 진행률이 아니다 — 단계가 얼마나 남았는지는 말하지 않는다. "
        + "RUNNING 이고 단계가 있을 때만 채워지고, PENDING · 종결(COMPLETED · FAILED · CANCELED)이면 null. "
        + "배포 직전부터 돌던 작업은 첫 단계 전이 전까지 null 일 수 있다",
        example = "2026-09-30T14:03:12.345+09:00", nullable = true)
    String stepStartedAt,

    @Schema(description = "전체 단계 수. 화면의 \"n / m 단계\" 에서 m 이다. 단계가 늘면 이 값도 함께 늘어난다", example = "4")
    int totalSteps,

    @Schema(description = "일정을 만들 때 쓴 생성 조건. **상태를 가리지 않고 채워진다** — 초안을 담는 데 필요한 "
        + "지역·기간·반려견이 여기 있어서, 작업 주소를 다른 브라우저·기기에서 열어도 화면이 조건을 되살릴 수 있다. "
        + "제출 때 생략한 값(sigunguCode · budget · requestNote)은 null 이다. "
        + "블록 자체가 null 인 경우는 저장된 요청 파라미터가 비어 있는 잡뿐이라 정상 경로에서는 생기지 않지만, "
        + "**화면은 null 가드를 두는 편이 안전하다**",
        nullable = true)
    AiPlanJobConditionsResponse conditions,

    @Schema(description = "생성된 일정 초안. status=COMPLETED 일 때만 채워지고 그 외에는 null", nullable = true)
    AiPlanDraftResponse planDraft,

    @Schema(description = "이 작업의 초안을 이미 담은 일정 아이디(Snowflake, 문자열). COMPLETED 이고 담은 적이 있을 때만 채워지고 "
        + "그 외(대기·실행·실패·취소, 담기 전, 담은 일정을 삭제한 뒤)는 null. "
        + "plan-service 조회에 실패해도 null — 그때 담기를 눌러도 새 일정은 생기지 않는다(멱등 키는 plan-service 에 있다)",
        example = "1234567890123456789", nullable = true)
    String committedPlanId,

    @Schema(description = "실패 사유 코드. status=FAILED 일 때만 채워지고 그 외에는 null", example = "AIPLAN_005", nullable = true)
    String errorCode,

    @Schema(description = "실패 사유 메시지. status=FAILED 일 때만 채워지고 그 외에는 null",
        example = "AI 일정 생성 작업이 실패했습니다.", nullable = true)
    String errorMessage
) {

}
