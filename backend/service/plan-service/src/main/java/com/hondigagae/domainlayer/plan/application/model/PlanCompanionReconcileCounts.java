package com.hondigagae.domainlayer.plan.application.model;

/**
 * 동행견 대사 처리 건수.
 *
 * <p>일정 하나 → 반려견 하나 → 회원 하나 → 회차로 <b>같은 타입을 더해 올라간다</b>. 단계마다
 * 다른 결과 타입을 두면 어느 층에서 수가 새는지 로그만 보고는 알 수 없다.
 *
 * <p>수를 따로 세는 이유는 <b>같지 않기 때문</b>이다.
 * <ul>
 *   <li>{@code detached} — 실제로 지운 {@code plan_pet} 행</li>
 *   <li>{@code representativeChanged} — {@code plan.pet_id} 승계·복구</li>
 *   <li>{@code placeholderKept} — <b>지울 수 있었지만</b> 마지막 한 마리라 남긴 일정 (R3 발동)</li>
 *   <li>{@code legacyPlansSkipped} — 조인 테이블 행이 아예 없어 <b>지울 것 자체가 없던</b> 옛 일정.
 *       R3 와 합쳐 세면 "R3 가 몇 번 발동했는가" 를 로그에서 읽을 수 없어 따로 센다</li>
 *   <li>{@code remoteCalls} — auth-service 왕복 수. 회원당 한 번인 구조가 유지되는지 보는 눈이다</li>
 * </ul>
 */
public record PlanCompanionReconcileCounts(
    int detached,
    int representativeChanged,
    int placeholderKept,
    int legacyPlansSkipped,
    int remoteCalls
) {

    public static final PlanCompanionReconcileCounts NONE = new PlanCompanionReconcileCounts(0, 0, 0, 0, 0);

    public static PlanCompanionReconcileCounts detached(int detached, int representativeChanged) {
        return new PlanCompanionReconcileCounts(detached, representativeChanged, 0, 0, 0);
    }

    /** 마지막 한 마리라 떼어내지 않고 자리 표시자로 남긴 일정 (R3). */
    public static PlanCompanionReconcileCounts placeholderKept(int representativeChanged) {
        return new PlanCompanionReconcileCounts(0, representativeChanged, 1, 0, 0);
    }

    /** 조인 테이블 행이 없는 옛 일정 — 지울 행이 없어 그대로 지나간다. */
    public static PlanCompanionReconcileCounts legacyPlanSkipped() {
        return new PlanCompanionReconcileCounts(0, 0, 0, 1, 0);
    }

    /** auth-service 왕복 한 번. */
    public static PlanCompanionReconcileCounts remoteCall() {
        return new PlanCompanionReconcileCounts(0, 0, 0, 0, 1);
    }

    public PlanCompanionReconcileCounts plus(PlanCompanionReconcileCounts other) {
        return new PlanCompanionReconcileCounts(
            detached + other.detached,
            representativeChanged + other.representativeChanged,
            placeholderKept + other.placeholderKept,
            legacyPlansSkipped + other.legacyPlansSkipped,
            remoteCalls + other.remoteCalls);
    }
}
