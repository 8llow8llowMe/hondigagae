package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.util.List;

/**
 * tour-service 내부 산책 코스 후보 응답의 Feign 전용 표현 (coding-conventions §12-1).
 *
 * <p>원천 DTO({@code WalkCourseCandidateInternalResponse})를 그대로 끌어오지 않고 <b>쓰는 것만</b>
 * 다시 선언한다 — 일정 상세 항목의 코스 요약(이슈 #619)에 필요한 값이다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanWalkCourseClientResponse(
    Long walkCourseId,
    String name,
    String courseLabel,
    BigDecimal distanceKm,
    String durationText,
    Integer durationMaxMinutes,
    Double lat,
    Double lng,
    String firstImage,
    List<ActivityFit> fitsActivityLevels
) {

    /**
     * 활동량 한 값의 code/name/description. tour-service 가 펴서 주는 모양 그대로 받는다 —
     * 공통 metadata 타입({@code CodeNameDescriptionMetadata})은 <b>웹 경계에서</b> 씌운다
     * ({@code PlanPresenter}). 기상특보({@code WeatherWarningClientResponse})가 같은 모양이다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ActivityFit(
        String code,
        String name,
        String description
    ) {

    }
}
