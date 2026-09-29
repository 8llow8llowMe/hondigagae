package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalTime;

/**
 * 일정 항목 시작 시각 수정 요청 (#1030).
 *
 * <p>{@code startTime} 에 {@code @NotNull} 을 걸지 않는다 — null 이 "시각 비우기" 라는 정상 요청이다.
 * 일괄 교체의 {@code PlanItemRequest.startTime} 과 같은 형식(HH:mm:ss)을 받는다.
 */
@Schema(description = "일정 항목 시작 시각 수정 요청 DTO")
public record PlanItemStartTimeRequest(

    @Schema(description = "시작 시각 (HH:mm:ss). null 이거나 필드를 빼면 시각을 비웁니다.",
        example = "10:30:00", nullable = true)
    LocalTime startTime
) {

}
