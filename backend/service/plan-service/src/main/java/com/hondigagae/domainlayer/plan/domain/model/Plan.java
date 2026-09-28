package com.hondigagae.domainlayer.plan.domain.model;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.Builder;

/**
 * 여행 일정.
 *
 * @param petId 대표 반려견 — 동행 목록({@link PlanPet})의 첫 번째와 같다. 목록 전체는 조인
 *              테이블에 있고, 이 필드는 "한 마리만 필요한" 자리(내부 개요의 특성 조회 키 등)와
 *              조인 테이블이 생기기 전 일정의 유일한 기록으로 남는다
 */
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

    /**
     * 여행이 시작됐는가 — {@code today} 가 시작일 당일이거나 그 뒤면 참이다.
     *
     * <p><b>여행 전 상태 가드의 단일 판정이다.</b> 완료 전이(#971)와 다녀옴 표시(#983)가 모두 이 메서드로
     * "아직 떠나지 않은 여행" 을 가른다. 판정을 호출부마다 따로 쓰면 한쪽은 당일을 포함하고 다른 쪽은
     * 빼는 식으로 어긋난다. 시작일 당일을 포함하는 것은 당일치기 여행이 있기 때문이다.
     *
     * @param today 서비스 기준 오늘(KST). 호출부가 주입된 {@code Clock} 으로 구한다
     */
    public boolean hasStarted(LocalDate today) {
        return !today.isBefore(startDate);
    }

    public boolean containsDay(int day) {
        return day >= 1 && day <= totalDays();
    }

    public Plan markDeleted() {
        return toBuilder().deleted(true).build();
    }

    /**
     * 동행 반려견 목록. 조인 테이블에 저장된 행이 없으면 {@code petId} 한 마리가 곧 목록이다 —
     * 조인 테이블이 생기기 전에 만든 일정이 그렇다. 이 해석이 여기 한 곳에만 있어야
     * 상세·목록·날씨 판정이 옛 일정을 서로 다르게 읽지 않는다.
     */
    public List<Long> resolvePetIds(List<PlanPet> storedPets) {
        if (storedPets == null || storedPets.isEmpty()) {
            return List.of(petId);
        }
        return storedPets.stream().map(PlanPet::petId).toList();
    }
}
