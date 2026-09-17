package com.hondigagae.domainlayer.walkcourse.application.info;

import com.hondigagae.domainlayer.walkcourse.application.port.out.query.WalkCourseQueryResult;
import com.hondigagae.domainlayer.walkcourse.domain.model.WalkCourseActivityFit;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.math.BigDecimal;
import java.util.List;
import lombok.Builder;

@Builder
public record WalkCourseInfo(
    long walkCourseId,
    String courseNo,
    String variant,
    int courseOrder,
    String name,
    BigDecimal distanceKm,
    String durationText,
    Integer durationMaxMinutes,
    String startEndPoint,
    Double lat,
    Double lng,
    String firstImage,
    String baseDate
) {

    public static WalkCourseInfo from(WalkCourseQueryResult result) {
        return WalkCourseInfo.builder()
            .walkCourseId(result.walkCourseId())
            .courseNo(result.courseNo())
            .variant(result.variant())
            .courseOrder(result.courseOrder())
            .name(result.name())
            .distanceKm(result.distanceKm())
            .durationText(result.durationText())
            .durationMaxMinutes(result.durationMaxMinutes())
            .startEndPoint(result.startEndPoint())
            .lat(result.lat())
            .lng(result.lng())
            .firstImage(result.firstImage())
            .baseDate(result.baseDate())
            .build();
    }

    /** 화면이 부르는 이름. 변형이 있으면 "3코스 (A)", 없으면 "1-1코스"다. */
    public String courseLabel() {
        return variant == null || variant.isBlank()
            ? courseNo + "코스"
            : courseNo + "코스 (" + variant + ")";
    }

    /**
     * 이 코스를 걸을 만한 활동량. 판정은 {@link WalkCourseActivityFit} 하나가 갖는다 -
     * 목록 필터가 쓰는 것과 <b>같은 상한</b>이라야 "목록에는 나오는데 힌트에는 없는" 코스가 없다.
     */
    public List<ActivityLevel> fitActivityLevels() {
        return WalkCourseActivityFit.fittingLevels(durationMaxMinutes);
    }
}
