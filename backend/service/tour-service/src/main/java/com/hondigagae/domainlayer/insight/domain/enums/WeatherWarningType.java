package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 기상특보 종류.
 *
 * <p>반려견 여행에 미치는 영향이 종류마다 다르다. 그래서 하나로 뭉뚱그리지 않는다 -
 * 건조주의보와 태풍경보를 같은 무게로 다루면 어느 쪽도 제대로 전달되지 않는다.
 *
 * <p>원천이 코드가 아니라 <b>문구</b>로 준다({@code "호우주의보"}). 표기가 조금 바뀌어도
 * 잡히도록 부분 문자열로 판정한다 ({@code MidTermWeatherText} 와 같은 이유).
 */
@Getter
@RequiredArgsConstructor
public enum WeatherWarningType implements CodeNameDescribable {

    TYPHOON("태풍", "강풍과 폭우가 함께 옵니다. 야외 활동을 하지 않는 것이 좋습니다.", "태풍"),
    HEAVY_RAIN("호우", "많은 비가 예상됩니다. 하천변과 저지대 산책로는 피해야 합니다.", "호우"),
    STRONG_WIND("강풍", "바람이 강합니다. 소형견은 몸이 밀릴 수 있고 낙하물 위험이 있습니다.", "강풍"),
    HEAT_WAVE("폭염", "더위가 심합니다. 노면이 뜨거워 발바닥 화상 위험이 큽니다.", "폭염"),
    COLD_WAVE("한파", "추위가 심합니다. 소형견과 단모종에게 부담이 큽니다.", "한파"),
    HEAVY_SNOW("대설", "많은 눈이 예상됩니다. 제설제가 발바닥을 상하게 할 수 있습니다.", "대설"),
    // 열대야는 2026-09-01 실호출에서 제주에 실제로 발효 중이던 특보다.
    // 밤에도 기온이 안 떨어져 "저녁 산책"이라는 회피 수단 자체가 막힌다.
    TROPICAL_NIGHT("열대야", "밤에도 기온이 내려가지 않습니다. 저녁 산책도 더위를 피하기 어렵습니다.", "열대야"),
    WIND_WAVE("풍랑", "바다가 거칩니다. 해안 산책로 접근에 주의가 필요합니다.", "풍랑"),
    DRY("건조", "건조합니다. 산불 위험이 있어 오름과 숲길 통제가 있을 수 있습니다.", "건조"),
    /** 못 알아본 문구. 특보가 있다는 사실 자체는 버리지 않는다. */
    OTHER("기타 특보", "기상특보가 발효 중입니다. 상세 내용은 기상청 발표를 확인해 주세요.", null);

    private final String displayName;
    private final String description;
    /** 원천 문구에서 찾을 조각. {@code null} 이면 매칭 대상이 아니다. */
    private final String keyword;

    /**
     * 특보 문구에서 종류를 뽑는다. 못 알아보면 {@link #OTHER} 다.
     *
     * <p><b>모르는 문구를 "특보 없음"으로 접지 않는다.</b> 특보가 떠 있는데 없다고 말하는 것이
     * 이 기능에서 가장 나쁜 실패다 - 표기가 바뀌었을 뿐인데 태풍을 놓치게 된다.
     */
    public static WeatherWarningType from(String text) {
        if (text == null || text.isBlank()) {
            return OTHER;
        }
        String normalized = text.replace(" ", "");
        for (WeatherWarningType type : values()) {
            if (type.keyword != null && normalized.contains(type.keyword)) {
                return type;
            }
        }
        return OTHER;
    }
}
