package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanBriefingScheduleItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanBriefingWalkTimesItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanBriefingWeatherWarningItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDayWeatherItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 하루치 여행 브리핑 응답 — 그날 일정 요약 + 날씨 + 기상특보 + 산책 골든타임.
 *
 * <p><b>특보·골든타임은 요청 날짜가 오늘일 때만 채워진다.</b> {@code today} 가 false 면 두
 * 필드는 null 이고 각각의 {@code *UnavailableReason} 에 이유가 담긴다. 특보는 필드와 이유가
 * <b>둘 다 null</b> 일 때만 "발효 중인 특보 없음" 이다 — 확인하지 못한 날은 이유가 채워진다.
 *
 * <p>준비물은 담지 않는다. ai-service 의 준비물 API 가 따로 있고, 이 응답은 LLM 을 부르지 않는
 * 결정적 조합만 묶는다.
 */
@Builder
@Schema(description = "여행 브리핑 응답 DTO")
public record PlanBriefingResponse(

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(description = "일정 제목", example = "몽실이와 제주 2박 3일")
    String planTitle,

    @Schema(description = "일차 (1부터)", example = "2")
    int day,

    @Schema(description = "브리핑 대상 일자", example = "2026-09-13")
    LocalDate date,

    @Schema(description = "요청 날짜가 오늘인지. false 면 weatherWarning·walkTimes 는 null 이고 각 *UnavailableReason 에 이유가 담긴다",
        example = "true")
    boolean today,

    @Schema(description = "판정에 들어간 동행 반려견 아이디 목록. basisPetId 는 이 안의 하나다",
        example = "[\"1234567890123456789\"]")
    List<String> petIds,

    @Schema(description = "그날 판정의 기준이 된 반려견 아이디 — 날씨 판정이 고른 아이(점수가 가장 낮은 아이)가 있으면 그 아이, "
        + "없으면 대표 반려견. 골든타임도 이 아이의 조건으로 판정된다", example = "1234567890123456789", nullable = true)
    String basisPetId,

    @Schema(description = "반려견 특성이 한 마리라도 판정에 반영됐는지. false 면 특성 조회에 실패해 일반 조건으로 판정한 결과다",
        example = "true")
    boolean petConditionApplied,

    @Schema(description = "그날 일정 요약 — 항목 수, 첫/마지막 항목, 대표 장소")
    PlanBriefingScheduleItem schedule,

    @Schema(description = "그날 날씨·적합도 브리핑. 일정 날씨 브리핑(GET /plans/{planId}/weather)의 하루치와 같은 모양·같은 판정이다")
    PlanDayWeatherItem weather,

    @Schema(description = "발효 중인 기상특보 중 가장 무거운 한 건. 오늘이 아니거나, 특보가 없거나, 확인하지 못했으면 null — "
        + "weatherWarningUnavailableReason 으로 가른다", nullable = true)
    PlanBriefingWeatherWarningItem weatherWarning,

    @Schema(description = "특보를 붙이지 못한 이유. null 이면 확인을 마친 것이고, weatherWarning 도 null 이면 발효 중인 특보가 없다. "
        + "값이 있으면 화면에 그대로 안내한다 — '확인 못 함' 을 '특보 없음' 으로 보이게 하지 않는다",
        example = "기상특보는 출발 당일에만 확인합니다.", nullable = true)
    String weatherWarningUnavailableReason,

    @Schema(description = "오늘의 산책 골든타임 — 그날 대표 장소 좌표 기준. 오늘이 아니거나 붙이지 못했으면 null", nullable = true)
    PlanBriefingWalkTimesItem walkTimes,

    @Schema(description = "골든타임을 붙이지 못한 이유. null 이면 정상이며, 값이 있으면 화면에 그대로 안내한다",
        example = "산책 골든타임은 출발 당일에만 제공됩니다.", nullable = true)
    String walkTimesUnavailableReason
) {
}
