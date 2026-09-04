package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.JejuRegion;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.RegionWeather;
import com.hondigagae.domainlayer.insight.domain.model.RegionalWeatherComparison;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityEvaluator;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityReason;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityThresholds;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.InsightProperties;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * 제주 권역 날씨 비교.
 *
 * <p>답하는 질문이 장소 적합도와 다르다. 적합도는 "이 장소가 갈 만한가"이고 이쪽은
 * <b>"지금 섬 어느 쪽으로 가야 하나"</b> 다. 한라산이 섬을 기후로 갈라 놓기 때문에 성립하는
 * 질문이다 - 같은 시각에 북부는 비가 오고 남부는 개어 있는 일이 흔하다.
 *
 * <h2>호출 비용</h2>
 *
 * 권역마다 <b>대표 격자 하나씩</b>만 본다. {@code WeatherForecastProcessor} 를 그대로 쓰므로
 * 기존 격자 캐시에 그대로 얹힌다 - 그 격자에 장소가 있어 이미 받아 둔 예보면 호출이 0 이다.
 * 권역 안을 여러 격자로 훑으면 정확해지지만 호출이 권역 수의 몇 배가 된다. 개발계정 한도가
 * 일 1,000건이라 그 거래는 맞지 않고, 이 기능이 답하려는 것은 "어디가 더 나은가"이지
 * "정확히 몇 도인가"가 아니다.
 *
 * <h2>다섯 권역을 병렬로 본다</h2>
 *
 * 캐시가 다 비어 있으면 순차 조회는 <b>권역당 원천 왕복이 그대로 쌓인다.</b> 어댑터가 빈 응답에
 * 직전 회차로 한 번 더 시도하므로 권역당 최악 두 번이고, 다섯이면 응답이 수십 초까지 늘어진다.
 * 발표 직후나 배포 직후에 첫 요청자가 그것을 다 뒤집어쓴다.
 *
 * <p>다섯은 서로 독립이고 격자도 달라 함께 나가도 원천에 문제가 없다. 전용 풀
 * ({@code insightRegionalTaskExecutor})을 쓰는 이유와 크기를 권역 수에 맞춘 이유는
 * 그 빈 정의에 적어 두었다.
 *
 * <h2>한 권역이 실패해도 나머지로 답한다</h2>
 *
 * 다섯 곳 중 하나의 격자 조회가 실패했다고 비교 자체를 못 하는 것은 아니다. 실패한 권역은
 * 점수 없이 목록에 남고 추천 후보에서만 빠진다 - 목록에서 통째로 지우면 사용자는 그 권역이
 * 조회되지 않았다는 사실조차 모른다.
 *
 * <h2>밤에 다섯 곳이 다 비는 것은 장애가 아니다</h2>
 *
 * 기상청 단기예보 23시 회차는 자기 발표일 행을 하나도 주지 않는다. 그래서 오늘을 물으면
 * 23시 회차 이후 자정까지는 <b>다섯 권역이 모두</b> 예보 없음이 되는데, 그것을 5xx 로 올리면
 * 비교 API 가 밤마다 죽는 것처럼 보인다. 못 판정한 이유가 {@link ForecastCoverage} 로
 * 구분되므로, <b>다섯이 전부 진짜 장애일 때만</b> 실패로 올린다.
 */
@Slf4j
@Component
public class RegionalWeatherProcessor {

    private final WeatherForecastProcessor weatherForecastProcessor;
    private final InsightMapper insightMapper;
    private final InsightProperties insightProperties;
    private final WeatherWarningProcessor weatherWarningProcessor;
    private final Executor insightRegionalTaskExecutor;

    public RegionalWeatherProcessor(
        WeatherForecastProcessor weatherForecastProcessor, InsightMapper insightMapper,
        InsightProperties insightProperties, WeatherWarningProcessor weatherWarningProcessor,
        @Qualifier("insightRegionalTaskExecutor") Executor insightRegionalTaskExecutor
    ) {
        this.weatherForecastProcessor = weatherForecastProcessor;
        this.insightMapper = insightMapper;
        this.insightProperties = insightProperties;
        this.weatherWarningProcessor = weatherWarningProcessor;
        this.insightRegionalTaskExecutor = insightRegionalTaskExecutor;
    }

    /**
     * 권역별 하루 날씨와 추천.
     *
     * @param date 대상 날짜. 오늘 또는 내일을 전제로 한다
     * @param pet  반려견 조건. 더위/추위 민감이 점수에 반영된다
     */
    public RegionalWeatherComparison compare(LocalDate date, PetCondition pet) {
        SuitabilityThresholds thresholds = insightMapper.toThresholds(insightProperties);

        List<RegionWeather> regions = compareInParallel(date, pet, thresholds);

        if (regions.stream().noneMatch(RegionWeather::isScored)
            && regions.stream().allMatch(RegionWeather::isFailure)) {
            // 다섯 권역 어디도 예보를 못 받았고 그것이 전부 장애다. 빈 비교표를 주면
            // "전부 비슷하다"로 읽힌다. 반대로 예보 시간대가 지난 것뿐이면 정상 상태이므로
            // 이유를 담은 비교표를 그대로 준다.
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }

        // 특보는 지금 발효 중인 것이라 오늘에만 붙인다. 적합도·산책 위험도와 같은 규칙이다 -
        // 한 서비스가 화면마다 다른 말을 하면 안 된다.
        WeatherWarning warning = date.equals(LocalDate.now())
            ? weatherWarningProcessor.heaviestWarning().orElse(null)
            : null;
        return RegionalWeatherComparison.of(date, regions, warning);
    }

    /**
     * 다섯 권역을 함께 조회하고 <b>선언 순서대로</b> 모은다.
     *
     * <p>완료 순서가 아니라 선언 순서를 쓰는 것이 중요하다. 비교표의 줄 순서가 매번 달라지면
     * 사용자가 같은 화면을 두 번 볼 때 다른 것으로 읽고, 동점 추천의 타이브레이크도 흔들린다.
     *
     * <p>개별 조회는 예외를 던지지 않는다({@code toRegionWeather} 가 실패를 점수 없는 권역으로
     * 흡수한다). 그래도 {@code join()} 을 감싸는 이유는 인터럽트나 풀 포화 같은 <b>작업 밖의
     * 실패</b>가 남아 있어서다 - 그때도 비교 전체를 멎게 하지 않고 그 권역만 비운다.
     */
    private List<RegionWeather> compareInParallel(
        LocalDate date, PetCondition pet, SuitabilityThresholds thresholds
    ) {
        List<CompletableFuture<RegionWeather>> futures = new ArrayList<>();
        for (JejuRegion region : JejuRegion.values()) {
            futures.add(CompletableFuture.supplyAsync(
                () -> toRegionWeather(region, date, pet, thresholds), insightRegionalTaskExecutor));
        }

        List<RegionWeather> regions = new ArrayList<>();
        for (int index = 0; index < futures.size(); index++) {
            JejuRegion region = JejuRegion.values()[index];
            try {
                regions.add(futures.get(index).join());
            } catch (CompletionException | CancellationException exception) {
                log.warn("Regional weather task failed region={} reason={}",
                    region.name(), exception.getMessage());
                regions.add(unavailable(region, date, ForecastCoverage.UNAVAILABLE));
            }
        }
        return regions;
    }

    private RegionWeather toRegionWeather(
        JejuRegion region, LocalDate date, PetCondition pet, SuitabilityThresholds thresholds
    ) {
        List<WeatherForecast> forecasts = forecastsOf(region);
        ForecastCoverage coverage = WeatherForecast.coverageOn(forecasts, date);
        Optional<DailyWeather> daily = coverage.isUsable()
            ? DailyWeather.findByDate(DailyWeather.foldByDate(forecasts), date)
            : Optional.empty();
        if (daily.isEmpty()) {
            return unavailable(region, date, coverage);
        }

        // 권역 비교는 "밖에 나가기"를 전제한다. 실내 대피처는 없고(sheltered=false),
        // 바람은 그대로 맞는 것으로 본다(weatherExposed=true).
        List<SuitabilityReason> reasons = new ArrayList<>();
        int penalty = SuitabilityEvaluator.applyWeatherRules(
            daily.get(), pet, thresholds, false, true, reasons);

        return RegionWeather.builder()
            .region(region)
            .date(date)
            .weather(daily.get())
            .weatherScore(Math.max(0, 100 - penalty))
            .coverage(coverage)
            .reasons(reasons)
            .build();
    }

    /**
     * 점수를 못 낸 권역. 목록에서 지우지 않고 <b>왜</b> 못 냈는지를 근거로 남긴다.
     *
     * <p>"가져오지 못했다"와 "예보 시간대가 지났다"는 사용자가 할 일이 다르다 - 앞은 다시
     * 시도할 일이고 뒤는 내일을 보라는 뜻이다. 한 문장으로 뭉개면 둘 다 틀린 안내가 된다.
     */
    private RegionWeather unavailable(JejuRegion region, LocalDate date, ForecastCoverage coverage) {
        return RegionWeather.builder()
            .region(region)
            .date(date)
            .coverage(coverage)
            .reasons(List.of(unavailableReason(coverage)))
            .build();
    }

    private SuitabilityReason unavailableReason(ForecastCoverage coverage) {
        return switch (coverage) {
            case DAY_ENDED -> SuitabilityReason.informational(SuitabilityReasonCode.FORECAST_DAY_ENDED,
                "이 날짜의 예보 시간대가 이미 지나 비교에서 제외했습니다.");
            case OUT_OF_RANGE -> SuitabilityReason.informational(SuitabilityReasonCode.FORECAST_OUT_OF_RANGE,
                "이 권역의 예보가 아직 닿지 않는 날짜라 비교에서 제외했습니다.");
            default -> SuitabilityReason.informational(SuitabilityReasonCode.FORECAST_UNAVAILABLE,
                "이 권역의 예보를 가져오지 못해 비교에서 제외했습니다.");
        };
    }

    /**
     * 권역 대표 격자의 시각별 예보.
     *
     * <p>실패를 예외로 올리지 않는다 - 한 권역의 장애가 비교 전체를 막으면 안 된다. 빈 목록은
     * 곧 {@code ForecastCoverage.UNAVAILABLE} 로 읽힌다.
     *
     * <p>오늘/내일이라 단기예보만으로 충분하다. {@code dailyForecastsAt} 을 쓰면 중기예보
     * 경로까지 타는데, 이 기능이 다루는 날짜에는 쓸 일이 없는 왕복이다.
     */
    private List<WeatherForecast> forecastsOf(JejuRegion region) {
        try {
            return weatherForecastProcessor.forecastsAt(region.getLat(), region.getLng());
        } catch (InsightException exception) {
            log.info("Regional weather unavailable region={} errorCode={}",
                region.name(), exception.getErrorCode().getCode());
            return List.of();
        }
    }
}
