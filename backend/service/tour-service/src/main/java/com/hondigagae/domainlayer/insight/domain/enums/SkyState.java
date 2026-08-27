package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 기상청 단기예보 SKY(하늘상태) 코드.
 *
 * <p>원천은 숫자 코드 문자열("1"/"3"/"4")이고 2는 결번이다. 코드를 그대로 응답에 흘리면
 * 화면이 매직넘버를 해석해야 하므로 어댑터 경계에서 enum 으로 바꾼다 (coding-conventions §8-3).
 */
@Getter
@RequiredArgsConstructor
public enum SkyState implements CodeNameDescribable {

    CLEAR("1", "맑음", "구름이 거의 없는 상태입니다. 햇볕이 강해 지면이 빠르게 달아오릅니다."),
    MOSTLY_CLOUDY("3", "구름많음", "구름이 많지만 비는 예보되지 않은 상태입니다."),
    OVERCAST("4", "흐림", "하늘이 구름으로 덮인 상태입니다. 지면 온도가 덜 오릅니다."),
    UNKNOWN("", "정보 없음", "예보에 하늘상태가 포함되지 않았습니다.");

    private final String code;
    private final String displayName;
    private final String description;

    public static SkyState fromCode(String code) {
        if (code == null || code.isBlank()) {
            return UNKNOWN;
        }
        for (SkyState value : values()) {
            if (value.code.equals(code.trim())) {
                return value;
            }
        }
        return UNKNOWN;
    }

    /** 일사가 강해 노면이 달아오르는 상태인지. 노면온도 추정의 입력이다. */
    public boolean isStrongSunlight() {
        return this == CLEAR;
    }
}
