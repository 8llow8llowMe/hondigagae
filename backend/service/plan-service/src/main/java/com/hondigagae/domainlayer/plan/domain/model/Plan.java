package com.hondigagae.domainlayer.plan.domain.model;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import lombok.Builder;

@Builder(toBuilder = true)
public record Plan(
    long id,
    long memberId,
    long petId,
    String areaCode,
    String sigunguCode,
    String title,
    LocalDate startDate,
    LocalDate endDate,
    Integer budget,
    PlanStatus status,
    boolean deleted
) {

    public boolean isOwnedBy(long candidateMemberId) {
        return this.memberId == candidateMemberId;
    }

    /** 여행 일수 (당일치기 = 1일) */
    public int totalDays() {
        return (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }

    public boolean containsDay(int day) {
        return day >= 1 && day <= totalDays();
    }

    public Plan markDeleted() {
        return toBuilder().deleted(true).build();
    }
}
