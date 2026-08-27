package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 격자 한 곳의 한 시각 예보 (domain model).
 *
 * <p>기상청 응답은 <b>category 별로 한 행</b>이라 같은 시각의 기온/강수확률/하늘상태가
 * 서로 다른 행에 흩어져 있다. 어댑터에서 시각 기준으로 피벗해 이 모델로 만든다.
 * 원본의 행 구조는 adapter 밖으로 새지 않는다 (external-api-guide §3).
 *
 * <p>수치는 전부 Wrapper 다. 예보에 해당 category 가 없는 시각이 실제로 존재하고
 * (TMN/TMX 는 하루에 한 번만 온다), 0 과 값 없음을 구분해야 하기 때문이다.
 */
@Builder
public record WeatherForecast(
    int nx, int ny,
    LocalDateTime forecastAt,
    LocalDateTime baseAt,
    // TMP - 1시간 기온(섭씨)
    Double temperature,
    // POP - 강수확률(%)
    Integer precipitationProbability,
    PrecipitationType precipitationType,
    SkyState skyState,
    // REH - 습도(%)
    Integer humidity,
    // WSD - 풍속(m/s)
    Double windSpeed,
    // PCP - 숫자가 아니라 문자열이 섞여 오는 항목이라 전용 타입으로 감싼다
    PrecipitationAmount precipitation,
    // TMN / TMX - 하루 한 번만 오는 값이라 대부분의 시각에서 null 이다
    Double minTemperature,
    Double maxTemperature
) {

    /** 젖는 날씨인지. 강수형태와 강수량을 함께 본다 - PTY 가 없는 시각도 있다. */
    public boolean isWet() {
        return (precipitationType != null && precipitationType.isWet())
            || (precipitation != null && precipitation.hasPrecipitation());
    }

    /** 비 예보로 볼 만한 확률인지. 실내 대안 제안의 트리거다. */
    public boolean isRainLikely(int thresholdPercent) {
        return precipitationProbability != null && precipitationProbability >= thresholdPercent;
    }
}
