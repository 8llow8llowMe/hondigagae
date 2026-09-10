package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import lombok.Builder;

/**
 * 하루치 여행 브리핑 — 그날 일정 요약 + 날씨 + 기상특보 + 산책 골든타임.
 *
 * <p>날짜 하나로 접는 것이 이 응답의 형태를 정한다. 사용자가 아침에 묻는 것은 "오늘 뭐부터
 * 가고, 우산 필요하고, 언제 산책할까" 이지 여행 전체가 아니다.
 *
 * <p><b>특보·골든타임은 요청 날짜가 오늘일 때만 채워진다.</b> {@code today} 가 false 면 두
 * 필드는 null 이고 각각의 {@code *UnavailableReason} 에 이유가 담긴다 — 화면이 "정보가 없다"
 * 와 "아직 알 수 없다" 를 갈라 말할 수 있게 하기 위해서다.
 *
 * @param basisPetId 그날 판정의 기준이 된 반려견. 날씨 판정이 고른 아이가 있으면 그 아이,
 *                   없으면 {@code petIds} 의 첫 번째(대표)다 — 골든타임 조회에 이 아이의
 *                   조건이 들어간다
 * @param weatherWarningUnavailableReason 특보를 붙이지 못한 이유. null 이면 정상이며,
 *                                        <b>{@code weatherWarning} 이 null 이고 이 값도 null 이면
 *                                        "발효 중인 특보 없음"</b> 이다
 */
@Builder
public record PlanBriefingInfo(
    long planId,
    String planTitle,
    int day,
    LocalDate date,
    boolean today,
    List<Long> petIds,
    Long basisPetId,
    boolean petConditionApplied,
    ScheduleInfo schedule,
    PlanDayWeatherInfo weather,
    WeatherWarningInfo weatherWarning,
    String weatherWarningUnavailableReason,
    WalkTimesInfo walkTimes,
    String walkTimesUnavailableReason
) {

    /**
     * 그날 일정 요약.
     *
     * @param representativePlaceId 그날 기준이 된 장소. 장소성 항목이 없으면 null
     * @param representativeLat 대표 장소의 좌표. 원천에 없거나 delisted 면 null — 골든타임을
     *                          붙일 수 있는지가 여기서 갈린다
     */
    @Builder
    public record ScheduleInfo(
        int itemCount,
        int visitedCount,
        ItemBriefInfo firstItem,
        ItemBriefInfo lastItem,
        Long representativePlaceId,
        String representativePlaceTitle,
        Double representativeLat,
        Double representativeLng
    ) {

    }

    /** 첫/마지막 항목 요약. 순서는 {@code sequence} 기준이다. */
    @Builder
    public record ItemBriefInfo(
        long planItemId,
        int sequence,
        PlanItemType itemType,
        String title,
        LocalTime startTime,
        boolean visited
    ) {

    }

    /**
     * 발효 중인 기상특보. out-port 계약(QueryResult)을 application 표현으로 접는다 — Presenter
     * 까지 QueryResult 가 번지면 tour-service 응답 스키마 변화가 화면 조립 코드를 직접 흔든다
     * (architecture-guide §4, {@link PlanDaySuitabilityInfo} 와 같은 이유).
     */
    @Builder
    public record WeatherWarningInfo(
        String typeCode,
        String typeName,
        String typeDescription,
        String levelCode,
        String levelName,
        String levelDescription,
        boolean recommendationSuppressed,
        LocalDateTime effectiveAt
    ) {

    }

    /**
     * 오늘의 산책 골든타임 요약. 시간대별 곡선은 담지 않는다 — 브리핑은 요약이고, 곡선이 필요한
     * 화면은 tour 의 {@code GET /api/v1/insights/walk-times} 를 직접 부른다.
     */
    @Builder
    public record WalkTimesInfo(
        LocalDateTime from,
        String forecastCoverageCode,
        String forecastCoverageName,
        String forecastCoverageDescription,
        LocalDateTime goldenStart,
        LocalDateTime goldenEnd,
        String goldenLevelCode,
        String goldenLevelName,
        String goldenLevelDescription,
        String goldenLevelScoreDescription,
        String goldenWindowStatusCode,
        String goldenWindowStatusName,
        String goldenWindowStatusDescription,
        boolean petConditionApplied
    ) {

    }
}
