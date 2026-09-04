package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 산책 위험도 판정 근거 코드.
 *
 * <p>적합도 근거({@link SuitabilityReasonCode})와 코드 체계를 나눈 이유는 보는 대상이 달라서다.
 * 적합도는 사람의 여행 조건을 보고, 위험도는 <b>지면과 호흡</b>을 본다. 사람 기준으로는 아무
 * 문제 없는 25도 맑은 날에도 아스팔트는 50도를 넘는다.
 */
@Getter
@RequiredArgsConstructor
public enum WalkSafetyReasonCode implements CodeNameDescribable {

    PAVEMENT_HEAT("노면 고온", "아스팔트 표면 온도가 높아 발바닥 화상 위험이 있습니다."),
    PAVEMENT_OK("노면 적정", "지면 온도가 산책에 무리 없는 수준입니다."),
    HEAT_INDEX_HIGH("열지수 높음", "기온과 습도를 함께 보면 체감 부담이 큽니다."),
    BRACHYCEPHALIC("단두종 주의", "코가 짧은 견종은 고온에서 체온 조절이 어렵습니다."),
    HEAT_SENSITIVE("더위 민감", "더위에 약한 아이라 같은 기온에도 부담이 큽니다."),
    COLD_SENSITIVE("추위 민감", "추위에 약한 아이라 같은 기온에도 부담이 큽니다."),
    COLD_RISK("저온 주의", "기온이 낮아 장시간 산책에 주의가 필요합니다."),
    WET_SURFACE("젖은 노면", "비나 눈으로 노면이 젖어 있어 미끄러짐에 주의가 필요합니다."),
    WIND_STRONG("강풍 주의", "바람이 강해 소형견 산책에 주의가 필요합니다."),
    WEATHER_WARNING_ACTIVE("기상특보 발효", "기상특보가 발효 중이라 야외 산책을 권하지 않습니다."),
    SAFE_WINDOW("안전 시간대", "같은 날 안에 더 안전한 산책 시간대가 있습니다."),
    FORECAST_OUT_OF_RANGE("시각별 예보 없음",
        "3일 이후는 오전/오후 단위 중기예보만 제공되어 시각별 노면 상태를 판단할 수 없습니다."),
    FORECAST_DAY_ENDED("남은 예보 없음",
        "그 날짜의 예보 시간대가 이미 지나 시각별 노면 상태를 판단하지 않았습니다."),
    FORECAST_UNAVAILABLE("날씨 정보 없음", "날씨 정보를 가져오지 못해 판단하지 못했습니다.");

    private final String displayName;
    private final String description;
}
