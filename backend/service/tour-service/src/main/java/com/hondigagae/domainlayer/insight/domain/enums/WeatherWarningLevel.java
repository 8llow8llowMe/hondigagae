package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 특보 단계.
 *
 * <p><b>주의보와 경보를 나누는 것이 이 enum 의 존재 이유다.</b> 경보는 기상청이 "나가지 말라"고
 * 말하는 단계다. 그것을 주의보와 같은 감점으로 다루면 태풍경보에도 그럴듯한 점수가 나간다.
 *
 * <p><b>{@code description} 은 일정 유무를 전제하지 않는다</b> (#1173). 홈 특보 띠가 이 문장을
 * 그대로 그린다. 다가오는 일정이 없는 사람에게도 나가므로 "일정을 조정하라"·"일정을 취소하라"고
 * 말하지 않는다. 종류별 사실(바다, 노면, 한파)은 {@link WeatherWarningType} 이 맡고, 여기는
 * 단계가 뜻하는 바깥 활동 주의만 말한다. 말투는 같은 화면의 insight enum 과 같이 합니다체다.
 */
@Getter
@RequiredArgsConstructor
public enum WeatherWarningLevel implements CodeNameDescribable {

    ADVISORY("주의보", "기상 조건이 나빠지고 있습니다. 바깥 활동은 주의가 필요합니다.", "주의보"),
    WARNING("경보", "기상청이 위험을 경고한 단계입니다. 바깥 활동은 피하는 편이 좋습니다.", "경보");

    private final String displayName;
    private final String description;
    private final String keyword;

    /** 문구에서 단계를 뽑는다. "경보"를 먼저 본다 - 못 알아봤을 때 낮은 쪽으로 접으면 안 된다. */
    public static WeatherWarningLevel from(String text) {
        if (text != null && text.replace(" ", "").contains(WARNING.keyword)) {
            return WARNING;
        }
        return ADVISORY;
    }

    public boolean isWarning() {
        return this == WARNING;
    }
}
