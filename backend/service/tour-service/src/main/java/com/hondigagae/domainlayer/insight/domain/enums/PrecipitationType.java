package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 기상청 단기예보 PTY(강수형태) 코드.
 *
 * <p>단기예보는 0/1/2/3/4 를, 초단기실황은 5(빗방울)/6(빗방울눈날림)/7(눈날림)을 추가로 쓴다.
 * 두 오퍼레이션의 값을 한 enum 으로 받아 둔다.
 */
@Getter
@RequiredArgsConstructor
public enum PrecipitationType implements CodeNameDescribable {

    NONE("0", "없음", "강수가 예보되지 않았습니다."),
    RAIN("1", "비", "비가 예보되어 있습니다."),
    RAIN_SNOW("2", "비/눈", "비와 눈이 섞여 내릴 것으로 예보되어 있습니다."),
    SNOW("3", "눈", "눈이 예보되어 있습니다."),
    SHOWER("4", "소나기", "소나기가 예보되어 있습니다."),
    DRIZZLE("5", "빗방울", "약한 빗방울이 관측되고 있습니다."),
    DRIZZLE_SNOW("6", "빗방울눈날림", "약한 비와 눈이 섞여 관측되고 있습니다."),
    SNOW_FLURRY("7", "눈날림", "약한 눈이 관측되고 있습니다."),
    UNKNOWN("", "정보 없음", "예보에 강수형태가 포함되지 않았습니다.");

    private final String code;
    private final String displayName;
    private final String description;

    public static PrecipitationType fromCode(String code) {
        if (code == null || code.isBlank()) {
            return UNKNOWN;
        }
        for (PrecipitationType value : values()) {
            if (value.code.equals(code.trim())) {
                return value;
            }
        }
        return UNKNOWN;
    }

    /** 젖는 날씨인지. 실내 대안을 제안할지 가른다. */
    public boolean isWet() {
        return this != NONE && this != UNKNOWN;
    }
}
