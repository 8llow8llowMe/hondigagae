package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.WalkTimesInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.domain.model.GoldenWalkWindow;
import com.hondigagae.domainlayer.insight.domain.model.HourlyWalkSafety;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.WalkSafetyEvaluator;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.InsightProperties;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 오늘의 산책 골든타임.
 *
 * <p>기존 산책 위험도가 "지금 나가도 되나"를 답한다면 이쪽은 <b>"오늘 언제 나가야 하나"</b> 를
 * 답한다. 여름 제주에서는 이 질문이 더 중요하다 - 낮에는 어차피 못 나가고, 문제는 아침이
 * 나은지 저녁이 나은지다.
 *
 * <p>장소가 아니라 좌표로 받는다. 숙소에서 "오늘 산책 언제 갈까"를 묻는 상황이라 장소를
 * 고르기 전이다.
 *
 * <h2>판정을 복제하지 않는다</h2>
 *
 * {@code WalkSafetyEvaluator.hourlyCurve} 가 안전 시간대 탐색과 <b>같은 간이 판정</b>을 쓴다.
 * 여기서 따로 계산하면 같은 시각을 walk-safety 는 주의로, 골든타임은 안전으로 말하는 일이 생긴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalkTimesProcessor {

    private final WeatherForecastProcessor weatherForecastProcessor;
    private final WeatherWarningProcessor weatherWarningProcessor;
    private final InsightMapper insightMapper;
    private final InsightProperties insightProperties;

    public WalkTimesInfo findWalkTimes(double lat, double lng, PetCondition pet) {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        List<WeatherForecast> sameDay = weatherForecastProcessor.forecastsAt(lat, lng).stream()
            .filter(forecast -> forecast.forecastAt().toLocalDate().equals(today))
            .toList();
        if (sameDay.isEmpty()) {
            // 오늘 남은 예보가 없다. 곡선을 못 그리므로 빈 답 대신 명시적으로 실패시킨다.
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }

        List<HourlyWalkSafety> curve = WalkSafetyEvaluator.hourlyCurve(
            sameDay, pet, insightMapper.toThresholds(insightProperties), now);

        WeatherWarning warning = weatherWarningProcessor.heaviestWarning().orElse(null);

        return WalkTimesInfo.builder()
            .lat(lat)
            .lng(lng)
            .from(now)
            .curve(curve)
            // 경보 중에는 골든타임을 주지 않는다. 시간대 곡선이 아무리 좋아도 기상청이
            // 나가지 말라고 한 날에 "이때가 좋다"고 말하면 안 된다.
            .goldenWindow(isWarningActive(warning) ? null : GoldenWalkWindow.from(curve).orElse(null))
            .weatherWarning(warning)
            .petConditionApplied(pet.isSpecified())
            .build();
    }

    private boolean isWarningActive(WeatherWarning warning) {
        return warning != null && warning.level().isWarning();
    }
}
