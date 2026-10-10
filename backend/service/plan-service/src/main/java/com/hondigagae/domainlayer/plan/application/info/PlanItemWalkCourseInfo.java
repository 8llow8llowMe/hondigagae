package com.hondigagae.domainlayer.plan.application.info;

import java.math.BigDecimal;
import java.util.List;
import lombok.Builder;

/**
 * 일정 항목에 붙는 산책 코스 요약 (이슈 #619).
 *
 * <p>{@code WALK} 항목의 {@code targetId} 는 {@code walk_course.id} 라 장소 요약이 붙지 않는다 —
 * 그래서 산책 항목만 이름 말고는 아무것도 없는 줄로 내려가고 있었다.
 *
 * <p>{@code durationMaxMinutes} 의 null 은 "제한 없음"이 아니라 <b>"원천 문구를 파싱하지 못했다"</b>
 * 는 뜻이다. 그래서 {@code durationText} 원문을 함께 내린다.
 */
@Builder
public record PlanItemWalkCourseInfo(
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
     * 이 코스를 걸을 만한 활동량 한 값의 code/name/description.
     *
     * <p>판정과 표시 문구의 출처가 모두 tour-service 다. Presenter 가 공통 metadata 로 씌운다 —
     * 기상특보가 같은 자리에서 같은 방식으로 나른다 ({@code PlanBriefingInfo}).
     */
    @Builder
    public record ActivityFit(
        String code,
        String name,
        String description
    ) {

    }
}
