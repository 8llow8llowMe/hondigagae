package com.hondigagae.domainlayer.planner.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "일정을 만들 때 쓴 생성 조건 DTO. 제출(POST /ai-plans) 때 받은 값을 그대로 돌려준다. "
    + "**초안을 담는 데 필요한 조건만 담는다** — pinnedPlaceIds · preferFavorites · planId · regenerateDay 는 "
    + "일정 저장이 받지 않는 값이라 포함하지 않는다")
public record AiPlanJobConditionsResponse(

    @Schema(description = "여행 지역 코드 (관광 areaCode, 제주=39)", example = "39")
    String areaCode,

    @Schema(description = "관광 시군구코드 (제주시=4 · 서귀포시=3). 제출 때 지정하지 않았으면 null — 지역 전체로 짰다는 뜻이다",
        example = "4", nullable = true)
    String sigunguCode,

    @Schema(description = "여행 시작일 (yyyy-MM-dd)", example = "2026-09-11")
    LocalDate startDate,

    @Schema(description = "여행 종료일 (yyyy-MM-dd)", example = "2026-09-13")
    LocalDate endDate,

    @Schema(description = "동반 반려견 식별자 목록. **Snowflake 라 문자열로 내린다** (제출 계약과 같다). "
        + "제출 때 지정하지 않았으면 빈 배열이고, 그때는 회원의 대표 반려견으로 일정을 짰다",
        example = "[\"1234567890123456789\"]")
    List<String> petIds,

    @Schema(description = "예산 (원 단위). 제출 때 지정하지 않았으면 null", example = "400000", nullable = true)
    Long budget,

    @Schema(description = "요청 메모 (자연어 요구사항). 제출 때 지정하지 않았으면 null",
        example = "산책 위주로, 더위에 약한 아이라 실내 위주로 부탁해요", nullable = true)
    String requestNote
) {

}
