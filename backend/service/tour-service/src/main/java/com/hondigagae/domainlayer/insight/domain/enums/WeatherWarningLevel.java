package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 특보 단계.
 *
 * <p><b>주의보와 경보를 나누는 것이 이 enum 의 존재 이유다.</b> 경보는 기상청이 "나가지 말라"고
 * 말하는 단계다. 그것을 주의보와 같은 감점으로 다루면 태풍경보에도 그럴듯한 점수가 나간다.
 */
@Getter
@RequiredArgsConstructor
public enum WeatherWarningLevel implements CodeNameDescribable {

    ADVISORY("주의보", "기상 조건이 나빠지고 있습니다. 일정을 조정하는 편이 좋습니다.", "주의보"),
    WARNING("경보", "기상청이 위험을 경고한 단계입니다. 야외 일정은 취소하는 것이 좋습니다.", "경보");

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
