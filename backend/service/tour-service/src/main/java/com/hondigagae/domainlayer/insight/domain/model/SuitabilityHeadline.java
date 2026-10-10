package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.shared.travel.insight.SuitabilityLevel;
import java.util.Arrays;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * 적합도 결론 한 문장 (#1234). 화면이 등급명({@code 여행 적합}) 대신 크게 쓰는 서술형 결론이다.
 *
 * <p>프론트는 enum code 별 한국어를 만들지 않으므로(서버 metadata 를 그대로 렌더) 문구의 정본은 여기 하나다.
 * 반려견 이름은 넣지 않는다 - 화면이 카드 머리({@code 오늘 몽과})로 따로 붙인다.
 *
 * <h2>결론을 뒤집는 사실을 먼저 말한다</h2>
 *
 * 등급 문구만 쓰면 {@code 가도 괜찮지만 챙길 게 있어요} 바로 밑에 "반려견 출입 불가" 같은 반대 사실이 붙는다
 * (#1233 지도 미리보기의 결함). 그래서 <b>그 자체로 결론을 정하는 사실</b>이 있으면 그 사실을 결론으로 말한다.
 * 순서는 영향 크기(근거 정렬)가 아니라 <b>사실의 결정성</b>이다 - 들어갈 수 없으면 날씨는 의미가 없고,
 * 특보는 반려견 크기와 무관하게 모두에게 해당하며, 동반 여부를 모르면 "가기 좋아요" 는 반려견 여행에서 거짓이 된다.
 * 점수에 영향이 없는 안내(delta 0 - 반려견 크기를 몰라 "제한이 있다" 고만 알리는 경우)는 결론을 바꾸지 않는다.
 *
 * <h2>판단 근거가 부족해도 아는 사실은 말한다</h2>
 *
 * 밤에 그날 예보가 끝났거나 기상청 장애로 점수를 못 내도({@link SuitabilityLevel#INSUFFICIENT}) 출입 사실과 발효 중인
 * 특보는 날씨 예보와 무관하게 안다. 화면 카드는 근거 문장을 싣지 않으므로 여기서 null 을 주면 들어갈 수 없는 곳이나
 * 태풍경보가 "판단 근거 부족" 으로만 보인다. 특보는 판정기가 날씨 없이는 근거로 남기지 않아서 발효 여부를 따로 받는다.
 *
 * <h2>특보는 "다른 곳" 을 권하지 않는다</h2>
 *
 * 특보는 제주 전역 한 지점 기준이라 모든 장소에 같은 감점이 붙는다 - 특보가 원인인 날 "더 나은 다른 곳" 은 없다.
 *
 * <h2>"오늘" 은 기준 일자가 오늘일 때만 쓴다</h2>
 *
 * API 는 {@code targetDate} 를 받는다. 다른 날짜를 묻는 소비처에 "오늘 가기 좋아요" 를 주면 거짓이다.
 */
public final class SuitabilityHeadline {

    // 문구 정본. 짝을 이루는 둘은 "오늘" 이 들어간 쪽과 빠진 쪽이다.
    private static final String NOT_ALLOWED = "반려견과 함께 들어갈 수 없는 곳이에요";
    private static final String WARNING_TODAY = "기상특보가 있어 오늘은 바깥 활동을 줄이는 게 좋아요";
    private static final String WARNING_OTHER_DAY = "기상특보가 있어 바깥 활동을 줄이는 게 좋아요";
    private static final String SIZE_RESTRICTED = "반려견 크기 제한이 있어 확인이 필요해요";
    private static final String ALLOWANCE_UNKNOWN = "반려견 동반 여부를 확인하고 가세요";
    private static final String GOOD_TODAY = "오늘 가기 좋아요";
    private static final String GOOD_OTHER_DAY = "가기 좋아요";
    private static final String FAIR = "가도 괜찮지만 챙길 게 있어요";
    private static final String POOR_TODAY = "오늘은 다른 곳이 더 나아요";
    private static final String POOR_OTHER_DAY = "다른 곳이 더 나아요";

    private SuitabilityHeadline() {
    }

    /**
     * 결론 한 문장. 결정적 사실을 등급보다 먼저 본다.
     *
     * @param warningActive 기상특보가 발효 중인가. 판정기는 날씨가 없으면 특보를 근거로 남기지 않아 따로 받는다
     * @param today 판정 기준 일자가 오늘인가
     * @return 결정적 사실 없이 판단 근거가 부족하면({@link SuitabilityLevel#INSUFFICIENT}) null. 모르는 것을 결론으로 말하지 않는다
     */
    public static String of(SuitabilityScore score, boolean warningActive, boolean today) {
        return Arrays.stream(DecisiveFact.values())
            .filter(fact -> fact.appliesTo(score.reasons(), warningActive))
            .findFirst()
            .map(fact -> fact.headline(today))
            .orElseGet(() -> ofLevel(score.level(), today));
    }

    private static String ofLevel(SuitabilityLevel level, boolean today) {
        return switch (level) {
            case HIGH -> today ? GOOD_TODAY : GOOD_OTHER_DAY;
            case MEDIUM -> FAIR;
            case LOW -> today ? POOR_TODAY : POOR_OTHER_DAY;
            // 결정적 사실이 없는데 점수를 못 냈다 - 모르는 것을 결론으로 말하지 않는다.
            // default 없이 등급 전부를 다뤄야 등급이 늘 때 컴파일이 알려 준다.
            case INSUFFICIENT -> null;
        };
    }

    /** 결론을 정하는 사실. <b>선언 순서가 우선순위다.</b> */
    @RequiredArgsConstructor
    private enum DecisiveFact {

        PET_NOT_ALLOWED(SuitabilityReasonCode.PET_NOT_ALLOWED, NOT_ALLOWED, NOT_ALLOWED),
        // 특보는 오늘 판정에만 붙지만(PlaceSuitabilityProcessor) 다른 날짜로 오면 "오늘" 이 거짓이라 뺀 문구를 쓴다.
        WEATHER_WARNING(SuitabilityReasonCode.WEATHER_WARNING_ACTIVE, WARNING_TODAY, WARNING_OTHER_DAY),
        PET_SIZE_RESTRICTED(SuitabilityReasonCode.PET_SIZE_RESTRICTED, SIZE_RESTRICTED, SIZE_RESTRICTED),
        PET_ALLOWANCE_UNKNOWN(SuitabilityReasonCode.PET_ALLOWANCE_UNKNOWN, ALLOWANCE_UNKNOWN, ALLOWANCE_UNKNOWN);

        private final SuitabilityReasonCode code;
        private final String todayHeadline;
        private final String otherDayHeadline;

        private boolean appliesTo(List<SuitabilityReason> reasons, boolean warningActive) {
            return (this == WEATHER_WARNING && warningActive) || isPenaltyIn(reasons);
        }

        /** 감점(delta &lt; 0)으로 붙은 근거만 본다. 같은 코드의 정보성 안내는 결론을 바꾸지 않는다. */
        private boolean isPenaltyIn(List<SuitabilityReason> reasons) {
            return reasons != null && reasons.stream().anyMatch(reason -> reason.code() == code && reason.scoreDelta() < 0);
        }

        private String headline(boolean today) {
            return today ? todayHeadline : otherDayHeadline;
        }
    }
}
