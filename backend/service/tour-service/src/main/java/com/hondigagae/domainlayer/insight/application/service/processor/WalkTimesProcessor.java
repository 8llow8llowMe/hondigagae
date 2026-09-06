package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.WalkTimesInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.GoldenWindowStatus;
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
 * <h2>오늘 남은 시간이 없는 것은 오류가 아니다</h2>
 *
 * <b>밤마다 반드시 이 상태가 된다.</b> 기상청 단기예보 23시 회차는 자기 발표일 행을 하나도
 * 주지 않으므로(실측: {@code base_time=2300} 의 최초 예보가 익일 0000), 23시 회차가 올라온
 * 뒤부터 자정까지 "오늘"의 시각별 예보는 원천에 존재하지 않는다. 그 전에도 마지막 예보 시각을
 * 지나면 곡선은 비어 있다.
 *
 * <p>그래서 빈 곡선을 5xx 로 올리지 않는다 - 재시도해도 자정 전에는 풀리지 않는 것을
 * "잠시 후 다시 시도해 주세요"라고 말하는 셈이고, 화면은 이유 없이 사라진다. 대신
 * {@link ForecastCoverage} 로 <b>왜 비었는지</b>를 응답에 실어 화면이 말할 수 있게 한다.
 *
 * <h2>판정을 복제하지 않는다</h2>
 *
 * {@code WalkSafetyEvaluator.hourlyCurve} 가 안전 시간대 탐색과 <b>같은 간이 판정</b>을 쓴다.
 * 여기서 따로 계산하면 같은 시각을 walk-safety 는 주의로, 골든타임은 안전으로 말하는 일이 생긴다.
 *
 * <h2>추천이 없는 이유를 함께 준다</h2>
 *
 * 추천 구간이 없는 데에는 <b>성질이 다른 셋</b>이 있고({@link GoldenWindowStatus}), 화면이
 * 할 말이 각각 다르다. 예전에는 셋을 {@code goldenStart: null} 하나로 뭉개서 내보냈고,
 * 화면은 그중 "남은 시간이 전부 위험"이라는 문구만 갖고 있었다. 그래서 경보로 추천을 보류한
 * 날에도 <b>저녁 안전 구간이 초록으로 그려진 채</b> "남은 시간이 모두 위험 등급"이라고 말했다.
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

        List<WeatherForecast> forecasts = loadForecasts(lat, lng);
        List<WeatherForecast> sameDay = forecasts.stream()
            .filter(forecast -> forecast.forecastAt().toLocalDate().equals(today))
            .toList();

        List<HourlyWalkSafety> curve = WalkSafetyEvaluator.hourlyCurve(
            sameDay, pet, insightMapper.toThresholds(insightProperties), now, lat);
        ForecastCoverage coverage = coverageOf(forecasts, curve);

        WeatherWarning warning = weatherWarningProcessor.heaviestWarning().orElse(null);
        GoldenWalkWindow golden = goldenWindowOf(curve, warning);

        return WalkTimesInfo.builder()
            .lat(lat)
            .lng(lng)
            .from(now)
            .curve(curve)
            .forecastCoverage(coverage)
            .goldenWindow(golden)
            .goldenWindowStatus(goldenWindowStatusOf(curve, warning, golden))
            .weatherWarning(warning)
            .petConditionApplied(pet.isSpecified())
            .build();
    }

    /**
     * 추천 구간. <b>경보 중에는 곡선을 보지도 않는다.</b>
     *
     * <p>시간대 곡선이 아무리 좋아도 기상청이 나가지 말라고 한 날에 "이때가 좋다"고 말하면
     * 안 된다.
     */
    private GoldenWalkWindow goldenWindowOf(List<HourlyWalkSafety> curve, WeatherWarning warning) {
        if (isWarningActive(warning)) {
            return null;
        }
        return GoldenWalkWindow.from(curve).orElse(null);
    }

    /** 추천이 없다면 <b>왜</b> 없는지. 가르는 순서는 {@link GoldenWindowStatus#of} 에 있다. */
    private GoldenWindowStatus goldenWindowStatusOf(
        List<HourlyWalkSafety> curve, WeatherWarning warning, GoldenWalkWindow golden
    ) {
        return GoldenWindowStatus.of(!curve.isEmpty(), isWarningActive(warning), golden != null);
    }

    /**
     * 예보를 가져온다. <b>일시적 장애는 빈 목록으로 낮춘다.</b>
     *
     * <p>장소 산책 위험도가 이미 같은 선택을 해 두었다 - 날씨를 못 받았다는 것도 화면이 말할 수
     * 있는 정보라, 그 사실을 근거로 남기고 200 으로 답한다. 두 화면이 같은 원인에 다른 상태
     * 코드를 내면 프론트는 같은 상황을 두 벌로 처리하게 된다.
     *
     * <p><b>설정 오류(INSIGHT_004)는 그대로 올린다.</b> 그것은 배포가 잘못된 것이고, 200 뒤에
     * 숨기면 "오늘은 예보가 없네" 로 읽혀 며칠이고 발견되지 않는다.
     */
    private List<WeatherForecast> loadForecasts(double lat, double lng) {
        try {
            return weatherForecastProcessor.forecastsAt(lat, lng);
        } catch (InsightException exception) {
            if (exception.getErrorCode() != InsightErrorCode.WEATHER_UNAVAILABLE) {
                throw exception;
            }
            log.info("Walk times falls back to no-weather lat={} lng={} errorCode={}",
                lat, lng, exception.getErrorCode().getCode());
            return List.of();
        }
    }

    /**
     * 곡선이 비었을 때 <b>왜</b> 비었는지.
     *
     * <p>이 화면이 묻는 날짜는 언제나 오늘이라 "예보 범위 밖"은 나올 수 없다. 남는 것은 둘 -
     * 예보를 못 받았거나(장애), 오늘 예보 시간대가 지났거나(정상)다. 오늘 행이 있어도 남은
     * 시각이 없으면 곡선은 비므로, 판단 기준은 오늘 행의 유무가 아니라 <b>곡선</b>이다.
     */
    private ForecastCoverage coverageOf(List<WeatherForecast> forecasts, List<HourlyWalkSafety> curve) {
        if (forecasts.isEmpty()) {
            return ForecastCoverage.UNAVAILABLE;
        }
        return curve.isEmpty() ? ForecastCoverage.DAY_ENDED : ForecastCoverage.AVAILABLE;
    }

    private boolean isWarningActive(WeatherWarning warning) {
        return warning != null && warning.level().isWarning();
    }
}
