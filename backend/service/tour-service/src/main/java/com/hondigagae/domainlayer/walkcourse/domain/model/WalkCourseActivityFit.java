package com.hondigagae.domainlayer.walkcourse.domain.model;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.util.Arrays;
import java.util.List;

/**
 * 반려견 활동량 → 걸을 수 있는 소요시간 상한.
 *
 * <p>기준은 이 서비스가 정의한 값이다 - 공인 기준이 없어 {@link ActivityLevel} 의 설명
 * ("짧은 산책을 선호하며 장시간 활동을 힘들어합니다" 등)에서 끌어냈고, 그래서 여기 한 곳에만
 * 둔다. 화면·프롬프트가 각자 상한을 정하면 같은 아이에게 다른 코스를 권하게 된다.
 *
 * <ul>
 *   <li>LOW - 4시간(240분)까지. "장시간 활동을 힘들어한다"는 아이에게 5시간 코스를 권하지 않는다</li>
 *   <li>MEDIUM - 6시간(360분)까지. "일반적인 산책과 관광 일정을 소화한다"</li>
 *   <li>HIGH - 상한 없음. "긴 산책과 활동적인 일정을 선호한다"</li>
 * </ul>
 */
public final class WalkCourseActivityFit {

    private static final int LOW_MAX_MINUTES = 240;
    private static final int MEDIUM_MAX_MINUTES = 360;

    private WalkCourseActivityFit() {
    }

    /**
     * 이 소요시간의 코스를 그 활동량의 반려견이 걸을 만한지.
     *
     * <p>소요시간을 모르는 코스(null)는 참이다 - 모르는 것을 나쁜 것으로 판정해 목록에서
     * 지우면 사용자는 그 코스가 있다는 것조차 모른다.
     */
    public static boolean fits(ActivityLevel activityLevel, Integer durationMaxMinutes) {
        if (activityLevel == null || durationMaxMinutes == null) {
            return true;
        }
        return switch (activityLevel) {
            case LOW -> durationMaxMinutes <= LOW_MAX_MINUTES;
            case MEDIUM -> durationMaxMinutes <= MEDIUM_MAX_MINUTES;
            case HIGH -> true;
        };
    }

    /**
     * 이 소요시간의 코스가 맞는 활동량 전부. <b>판정은 {@link #fits} 하나뿐이다</b> - 여기서
     * 상한을 다시 적으면 목록 필터와 요약 힌트가 어긋나 "목록에는 나오는데 힌트에는 없는" 코스가
     * 생긴다.
     *
     * <p>소요시간을 모르는 코스는 {@code fits} 가 전부 참이라 세 값이 다 담긴다 - 모른다는 것을
     * "아무 아이나 된다" 로 읽지 않도록, 소비처는 {@code durationMaxMinutes} 가 null 인지 함께 본다.
     */
    public static List<ActivityLevel> fittingLevels(Integer durationMaxMinutes) {
        return Arrays.stream(ActivityLevel.values())
            .filter(activityLevel -> fits(activityLevel, durationMaxMinutes))
            .toList();
    }
}
