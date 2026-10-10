package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * @param petId  대표 반려견 — {@code petIds} 의 첫 번째와 같다
 * @param petIds 동행 반려견 전체
 * @param itemCount 일정 전체 항목 수 (모든 일자 합). 0 이면 빈 일정
 */
@Builder
public record PlanSummaryInfo(
    long planId,
    long petId,
    List<Long> petIds,
    String areaCode,
    String title,
    LocalDate startDate,
    LocalDate endDate,
    PlanStatus status,
    int itemCount
) {

}
