package com.hondigagae.domainlayer.insight.application.model;

import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 장소 단위 인사이트 조회 조건 (적합도 / 산책 위험도 공용).
 *
 * <p>반려견 조건이 파라미터로 들어오는 구조라 조건이 넷을 넘어 Query 로 묶는다
 * (coding-conventions §3).
 */
@Builder
public record PlaceInsightQuery(
    long placeId,
    // null 이면 오늘 기준. 단기예보 범위(약 3일) 밖이면 판정 근거가 없다고 응답한다.
    LocalDate targetDate,
    // 산책 위험도에서만 쓴다. null 이면 지금 시각 기준.
    LocalDateTime targetDateTime,
    PetCondition petCondition
) {

    public LocalDate resolvedDate() {
        return targetDate != null ? targetDate : LocalDate.now();
    }

    public LocalDateTime resolvedDateTime() {
        if (targetDateTime != null) {
            return targetDateTime;
        }
        LocalDate date = resolvedDate();
        // 날짜만 주어졌다면 오늘은 지금 시각, 다른 날은 활동이 몰리는 낮 시간을 기준으로 본다.
        return date.equals(LocalDate.now()) ? LocalDateTime.now() : date.atTime(14, 0);
    }
}
