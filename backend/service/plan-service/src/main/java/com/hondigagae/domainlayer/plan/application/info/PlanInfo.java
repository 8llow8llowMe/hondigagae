package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * @param petId  대표 반려견 — {@code petIds} 의 첫 번째와 같다
 * @param petIds 동행 반려견 전체. 한 마리 일정이면 원소 하나다
 * @param sourceAiJobId 이 일정을 만든 AI 일정 생성 작업 아이디. AI 초안을 담은 일정에만 있다 (#970)
 */
@Builder
public record PlanInfo(
    long planId,
    long petId,
    List<Long> petIds,
    String areaCode,
    String sigunguCode,
    String title,
    LocalDate startDate,
    LocalDate endDate,
    Integer budget,
    PlanStatus status,
    int totalDays,
    List<PlanItemInfo> items,
    String sourceAiJobId
) {

}
