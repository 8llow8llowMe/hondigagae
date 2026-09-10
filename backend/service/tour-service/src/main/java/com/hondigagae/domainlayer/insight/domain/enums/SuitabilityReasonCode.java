package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 적합도 판정 근거 코드 (XAI, api-design-guide §9).
 *
 * <p>근거 문장을 LLM 이 자유 생성하게 두지 않고 코드로 열거하는 이유는 services/ai-service.md 의
 * 방침 그대로다 - <b>근거는 데이터에서 조립하고 문장화만 맡긴다.</b> 여기 없는 이유는
 * 응답에 나올 수 없고, 여기 있는 이유는 반드시 실제 수치에서 나온다.
 *
 * <p>{@code description} 은 코드 자체의 뜻이고, 실제 응답에 실리는 문장은 판정 시점의 수치를
 * 넣어 따로 만든다 (기온 31도 같은 값이 들어가야 근거가 된다).
 */
@Getter
@RequiredArgsConstructor
public enum SuitabilityReasonCode implements CodeNameDescribable {

    // 동반 조건
    PET_ALLOWED("반려견 동반 가능", "반려견 출입이 확인된 장소입니다."),
    PET_PARTIALLY_ALLOWED("부분 동반 가능", "일부 구역 또는 조건부로만 동반이 가능한 장소입니다."),
    PET_NOT_ALLOWED("반려견 동반 불가", "반려견 출입이 불가능한 장소입니다."),
    PET_ALLOWANCE_UNKNOWN("동반 여부 미확인", "동반 가능 여부가 원천에 없어 확인이 필요합니다."),
    PET_SIZE_RESTRICTED("크기 제한", "반려견 크기가 장소의 입장 조건에 맞지 않습니다."),
    PET_EXTRA_FEE("추가 요금", "반려견 동반에 추가 요금이 있는 장소입니다."),

    // 날씨
    WEATHER_OK("날씨 적정", "기온과 강수 조건이 반려견 활동에 무리가 없습니다."),
    HEAT_RISK("고온 주의", "기온 또는 체감온도가 높아 반려견에게 부담이 되는 조건입니다."),
    COLD_RISK("저온 주의", "기온이 낮아 반려견에게 부담이 되는 조건입니다."),
    RAIN_EXPECTED("강수 예보", "비 또는 눈이 예보되어 야외 일정에 영향이 있습니다."),
    WIND_STRONG("강풍 주의", "바람이 강해 소형견 산책에 주의가 필요합니다."),
    INDOOR_SHELTER("실내 이용 가능", "실내 공간이 있어 날씨 영향을 덜 받습니다."),

    // 혼잡도
    LOW_CONGESTION("혼잡도 낮음", "관광객 집중도가 낮아 여유로운 방문이 가능합니다."),
    HIGH_CONGESTION("혼잡도 높음", "관광객 집중도가 높아 붐빌 것으로 예상됩니다."),
    NOISE_SENSITIVE_CROWD("소음 민감 주의", "붐비는 환경이 소음에 민감한 반려견에게 부담이 됩니다."),
    LOW_SOCIALITY_CROWD("사회성 낮음 주의", "붐비는 환경이 다른 개나 낯선 사람을 불편해하는 반려견에게 부담이 됩니다."),

    // 기상특보
    WEATHER_WARNING_ACTIVE("기상특보 발효", "기상특보가 발효 중이라 야외 일정에 큰 영향이 있습니다."),

    // 근거 부족
    FORECAST_OUT_OF_RANGE("예보 범위 밖", "예보가 닿지 않는 날짜라 날씨를 근거로 쓰지 못했습니다."),
    FORECAST_DAY_ENDED("남은 예보 없음", "그 날짜의 예보 시간대가 이미 지나 날씨를 근거로 쓰지 못했습니다."),
    MID_TERM_FORECAST("중기예보 기준", "3일 이후 예보라 단기예보보다 대략적입니다. 여행이 가까워지면 다시 확인해 주세요."),
    FORECAST_UNAVAILABLE("날씨 정보 없음", "날씨 정보를 가져오지 못해 날씨를 근거로 쓰지 못했습니다."),
    CONGESTION_UNAVAILABLE("혼잡도 정보 없음", "혼잡도 예측 데이터가 없어 근거로 쓰지 못했습니다.");

    private final String displayName;
    private final String description;
}
