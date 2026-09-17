package com.hondigagae.domainlayer.walkcourse.adapter.in.internal.dto;

import java.math.BigDecimal;
import java.util.List;
import lombok.Builder;

/**
 * 다른 서비스(plan-service)가 일정 항목에 붙이는 산책 코스 한 건 (이슈 #619).
 *
 * <p>공개 목록 응답({@code WalkCourseItem})과 다른 DTO 를 쓰는 이유는 소비 방식이 다르기
 * 때문이다. 일정 항목에 붙는 요약은 <b>카드 한 줄</b>이라 시종점·기준일자 같은 상세 필드를
 * 싣지 않는다.
 */
@Builder
public record WalkCourseCandidateInternalResponse(
    long walkCourseId,
    String name,
    // "3코스 (A)". 사용자가 코스를 부르는 이름은 코스번호라, 이름표를 서비스가 만들어 준다
    String courseLabel,
    BigDecimal distanceKm,
    String durationText,
    // 소요시간 상한(분). 원문을 파싱하지 못한 코스는 null - 지어내지 않는다
    Integer durationMaxMinutes,
    Double lat,
    Double lng,
    String firstImage,
    /*
      이 코스를 걸을 만한 반려견 활동량({@code ActivityLevel}).

      **판정을 tour-service 가 한다.** 코스 적합도의 주인이 이 서비스({@code WalkCourseActivityFit})
      이고, 그래야 plan-service 가 남의 반려견 활동량을 tour-service 로 넘기지 않아도 된다 -
      호출부는 자기 쪽 반려견 값과 이 목록을 맞춰 보기만 하면 된다.

      {@code durationMaxMinutes} 가 null 인 코스는 세 값이 다 담긴다. "아무 아이나 된다"가 아니라
      "모른다"는 뜻이라, 소비처는 상한이 null 인지 함께 본다.
    */
    List<ActivityFit> fitsActivityLevels
) {

    /**
     * 활동량 한 값의 code/name/description.
     *
     * <p>공통 metadata 타입({@code CodeNameDescriptionMetadata})을 그대로 싣지 않는다 - 내부 DTO 는
     * 소비 측이 자기 응답 모양으로 다시 조립하므로, 이쪽 metadata 타입을 실으면 그 타입이 서비스
     * 경계를 넘는다. {@code WeatherWarningInternalResponse} 가 같은 이유로 code/name/description 을
     * 펴서 준다.
     *
     * <p>이름·설명까지 보내는 이유는 소비 서비스가 {@code ActivityLevel} 을 다시 해석하지 않게
     * 하려는 것이다 - 표시 문구의 출처가 적합도 판정과 같은 곳이라야 두 서비스가 같은 코스에
     * 다른 말을 하지 않는다.
     */
    @Builder
    public record ActivityFit(
        String code,
        String name,
        String description
    ) {

    }
}
