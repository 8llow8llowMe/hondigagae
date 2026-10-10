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
 * @param sourceAiJobId 이 일정을 만든 AI 일정 생성 작업(ai-service jobId). AI 초안을 담은 일정에만 있고
 *              담기 멱등 키다 (#970). 복제본·일반 생성·삭제된 일정은 {@code null} 이다
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
    boolean deleted,
    String sourceAiJobId
) {

    /**
     * 일정 하나에 담을 수 있는 항목 수 상한 (#1243). <b>값은 여기 한 곳에만 둔다</b> — 요청 {@code @Size} ·
     * 검증 문구 · 에러 문구 · Swagger 설명이 전부 이 상수를 읽는다. FE 계약이라 바꿀 때는 FE 와 맞춘다.
     *
     * <p>상한이 없으면 일정 상세가 tour-service 에 묻는 요약 질의 문자열이 항목 수만큼 길어진다. 산책 코스는
     * 아이디가 19자리라 {@code walkCourseIds=<19자리>&} 한 개가 약 34바이트, Tomcat 기본 헤더 한도 8KB 에서
     * <b>약 240개</b>에 깨지고, 그 실패는 요약 장애로 삼켜져 요약만 비는 조용한 품질 저하가 된다.
     * 100 이면 산책 코스 약 3.4KB · 장소({@code placeIds=}, 약 29바이트) 약 2.9KB 로 한도 안이다.
     * 하루 10곳 × 10일(AI 일정 생성의 최대 기간) 수준이다.
     */
    public static final int MAX_ITEMS = 100;

    /**
     * 항목 수가 {@code currentCount} 에서 {@code nextCount} 로 바뀌는 편집을 받아도 되는가 (#1243).
     *
     * <p>상한 안이면 받는다. 상한을 넘더라도 <b>늘지 않으면</b> 받는다 — 상한이 생기기 전에 이미 넘은
     * 일정에서 줄이거나 순서만 고치는 편집까지 막으면 사용자가 그 일정을 상한 안으로 되돌릴 길이 없다.
     */
    public static boolean acceptsItemCount(int currentCount, int nextCount) {
        return nextCount <= MAX_ITEMS || nextCount <= currentCount;
    }

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

    /**
     * 삭제하면서 담기 멱등 키({@code sourceAiJobId})도 비운다 (#970). 유니크
     * {@code (member_id, source_ai_job_id)} 는 삭제된 행에도 걸리므로, 키를 남기면 같은 AI 초안을
     * 영영 다시 담을 수 없다 — 담기가 "이미 담았다" 로 삭제된 일정을 찾지도 못하고 새로 넣지도 못한다.
     * 비우면 삭제 뒤 다시 담기는 새 일정을 만든다.
     */
    public Plan markDeleted() {
        return toBuilder().deleted(true).sourceAiJobId(null).build();
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
