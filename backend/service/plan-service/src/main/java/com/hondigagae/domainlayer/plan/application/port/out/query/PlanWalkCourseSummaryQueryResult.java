package com.hondigagae.domainlayer.plan.application.port.out.query;

import java.math.BigDecimal;
import java.util.List;
import lombok.Builder;

/**
 * 일정 항목이 가리키는 산책 코스의 요약 (이슈 #619). tour-service 내부 후보 API 한 번으로 받아 온다.
 *
 * <p>목록에 아예 없는 아이디는 저장 시 검증되지 않은 {@code targetId} 이거나 수기로 정리된 행이다.
 * 그 항목은 <b>요약이 null 인 채로 응답에 남는다</b> — 사용자가 담아 둔 자료라 사라지면 안 된다
 * (장소 요약과 같은 판단이다).
 */
@Builder
public record PlanWalkCourseSummaryQueryResult(
    long walkCourseId,
    String name,
    String courseLabel,
    BigDecimal distanceKm,
    String durationText,
    Integer durationMaxMinutes,
    Double lat,
    Double lng,
    String firstImage,
    /*
      이 코스를 걸을 만한 반려견 활동량. 판정의 주인은 tour-service 다 —
      여기서 다시 상한을 계산하면 두 서비스가 같은 코스를 다르게 읽는다.
    */
    List<ActivityFit> fitsActivityLevels
) {

    /**
     * 활동량 한 값의 code/name/description.
     *
     * <p>공통 metadata 타입을 application 계층까지 끌어오지 않는다 — 기상특보가 같은 자리에서
     * {@code typeCode}/{@code typeName}/{@code typeDescription} 을 펴서 나르고, metadata 는
     * Presenter 가 씌운다.
     */
    @Builder
    public record ActivityFit(
        String code,
        String name,
        String description
    ) {

    }
}
