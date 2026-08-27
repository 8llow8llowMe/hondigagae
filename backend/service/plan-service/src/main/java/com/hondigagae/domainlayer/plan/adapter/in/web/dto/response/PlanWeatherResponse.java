package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDayWeatherItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 일정 날씨 브리핑 응답.
 *
 * <p>일자별로 {@code unavailableReason} 이 따로 있는 것이 이 응답의 요점이다. 어떤 날은
 * 예보가 닿고 어떤 날은 닿지 않는 것이 <b>정상</b>이라(단기예보는 약 3일까지),
 * 전체를 성공/실패로 나누면 그 차이를 표현할 수 없다.
 */
@Builder
@Schema(description = "일정 날씨 브리핑 응답 DTO")
public record PlanWeatherResponse(

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(description = "일정 제목", example = "몽실이와 제주 2박 3일")
    String planTitle,

    @Schema(description = "여행 시작일", example = "2026-09-12")
    LocalDate startDate,

    @Schema(description = "여행 종료일", example = "2026-09-14")
    LocalDate endDate,

    @Schema(
        description = "반려견 특성이 판정에 반영됐는지. false 면 특성 조회에 실패해 일반 조건으로 판정한 결과다",
        example = "true")
    boolean petConditionApplied,

    @Schema(description = "일자별 브리핑. 일정 일수만큼 항상 채워진다")
    List<PlanDayWeatherItem> days
) {
}
