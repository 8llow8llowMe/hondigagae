package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherObservationPort;
import com.hondigagae.domainlayer.insight.application.port.out.query.WeatherObservationQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.model.PrecipitationAmount;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.global.properties.KmaApiProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * 기상청 단기예보(getVilageFcst) 어댑터.
 *
 * <p>원본 응답의 함정을 여기서 전부 흡수한다. 어느 하나도 adapter 밖으로 새지 않는다.
 * <ul>
 *   <li><b>category 별 1행</b> - 같은 시각의 기온/강수확률/하늘상태가 서로 다른 행에 있다.
 *       시각 기준으로 피벗해 {@link WeatherForecast} 로 만든다</li>
 *   <li><b>PCP/SNO 는 문자열</b> - 강수없음, 1mm 미만, 30.0~50.0mm 가 섞여 온다.
 *       {@link PrecipitationAmount} 가 해석한다</li>
 *   <li><b>발표 회차 공백</b> - 회차 직후에는 데이터가 아직 없어 빈 응답이 온다.
 *       {@link KmaBaseTime#previous()} 로 한 단계 물러서서 재시도한다</li>
 *   <li><b>키 오류는 XML</b> - serviceKey 문제일 때 JSON 이 아니라 OpenAPI_ServiceResponse
 *       XML 이 온다. 파싱 전에 형태를 본다</li>
 *   <li><b>resultCode 는 00</b> - 관광공사 계열의 0000 과 다르다. 둘 다 받아 준다</li>
 *   <li><b>numOfRows 로 잘린다</b> - 한 회차가 1,000행을 넘는다. 잘리면 오류가 아니라
 *       마지막 날이 반쪽으로 오는데, 그 반쪽으로 하루를 접으면 최고기온이 실제보다 낮게 나온다.
 *       {@code totalCount} 와 받은 행 수를 비교해 잡는다</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaVillageForecastAdapter implements WeatherObservationPort {

    /** 서킷 인스턴스명. 제공처 단위로 분리한다 (coding-conventions §10). */
    public static final String CIRCUIT_NAME = "kma";

    private static final String OK_RESULT_CODE = "00";
    private static final String OK_RESULT_CODE_TOUR_STYLE = "0000";
    private static final String NO_DATA_RESULT_CODE = "03";

    private static final DateTimeFormatter FORECAST_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int RAW_BODY_LOG_LIMIT = 300;

    private final WebClient openApiWebClient;
    private final ObjectMapper objectMapper;
    private final KmaApiProperties kmaApiProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public WeatherObservationQueryResult fetchVillageForecast(KmaGridPoint grid) {
        int publishDelayMinutes = kmaApiProperties.publishDelayMinutes();
        KmaBaseTime baseTime = KmaBaseTime.latestAvailable(LocalDateTime.now(), publishDelayMinutes);

        List<WeatherForecast> forecasts = request(grid, baseTime);
        if (!forecasts.isEmpty()) {
            return toQueryResult(forecasts, baseTime, publishDelayMinutes);
        }

        // 회차 직후에는 데이터가 아직 올라오지 않았을 수 있다. 한 단계만 물러서서 재시도한다.
        KmaBaseTime fallback = baseTime.previous();
        log.info("KMA forecast empty, retrying previous base nx={} ny={} baseDate={} baseTime={} fallbackTime={}",
            grid.nx(), grid.ny(), baseTime.baseDateParam(), baseTime.baseTimeParam(), fallback.baseTimeParam());
        return toQueryResult(request(grid, fallback), fallback, publishDelayMinutes);
    }

    private WeatherObservationQueryResult toQueryResult(
        List<WeatherForecast> forecasts, KmaBaseTime baseTime, int publishDelayMinutes
    ) {
        return WeatherObservationQueryResult.builder()
            .forecasts(forecasts)
            // 캐시 수명을 고정 TTL 이 아니라 다음 발표 시각에 맞춘다. 발표 주기를 아는 것은
            // 기상청 프로토콜을 아는 이 어댑터의 책임이다.
            .nextPublishAt(baseTime.nextAvailableAt(publishDelayMinutes))
            .build();
    }

    private List<WeatherForecast> request(KmaGridPoint grid, KmaBaseTime baseTime) {
        URI uri = buildVillageForecastUri(grid, baseTime);
        String rawBody = requestRaw(uri);
        JsonNode body = parseAndValidate(rawBody);
        if (body == null) {
            return List.of();
        }

        List<JsonNode> items = extractItems(body);
        List<WeatherForecast> forecasts = pivotByForecastTime(grid, baseTime, items);

        int totalCount = body.path("totalCount").asInt(items.size());
        if (totalCount > items.size()) {
            log.warn("KMA forecast truncated by numOfRows totalCount={} received={} numOfRows={} grid={}",
                totalCount, items.size(), kmaApiProperties.numOfRows(), grid.cacheKey());
            return dropIncompleteTailDay(forecasts);
        }
        return forecasts;
    }

    /**
     * 잘린 응답의 <b>마지막 날짜를 버린다.</b>
     *
     * <p>행이 (fcstDate, fcstTime) 오름차순으로 오는 것을 실측으로 확인했다. 그래서 잘림은
     * 항상 꼬리를 자르고, <b>마지막 날짜만 반쪽이 된다.</b> 앞쪽 날짜는 온전하다.
     *
     * <p>반쪽인 채로 두면 조용히 틀린다. 실측 예: 09-01 이 21시까지 오던 것이 12시까지만 오면
     * TMX 가 사라져 최고기온이 시각별 기온의 최대값(30.0)으로 대체되는데, 실제 TMX 는 31.0 이다.
     * 1도 차이지만 고온 임계값이 31.0 이라 판정이 정확히 갈리고, 방향이 <b>"실제보다 안전하다"</b> 다.
     * {@code DailyWeather.hasDaySummary} 도 이것을 막지 못한다 - 12시 예보가 있으니 온전해 보인다.
     *
     * <p>버려도 커버리지가 비지 않는다. 그 날짜는 중기예보가 덮는다.
     *
     * <p>물론 근본 대응은 {@code numOfRows} 를 넉넉히 주는 것이고 기본값이 그렇게 잡혀 있다.
     * 이 메서드는 원천이 예보 범위를 늘렸을 때의 안전망이다 - 그때 WARN 로그가 먼저 뜬다.
     */
    static List<WeatherForecast> dropIncompleteTailDay(List<WeatherForecast> forecasts) {
        if (forecasts.isEmpty()) {
            return forecasts;
        }
        LocalDate lastDate = forecasts.get(forecasts.size() - 1).forecastAt().toLocalDate();
        List<WeatherForecast> kept = forecasts.stream()
            .filter(forecast -> !forecast.forecastAt().toLocalDate().equals(lastDate))
            .toList();
        // 받은 것이 한 날짜뿐이면 버릴 수 없다. 반쪽이라도 없는 것보다는 낫고,
        // 온전하지 않다는 사실은 hasDaySummary 가 시각 수로 다시 판정한다.
        return kept.isEmpty() ? forecasts : kept;
    }

    /**
     * serviceKey 는 슬래시와 등호 같은 예약 문자를 포함하므로 직접 인코딩해 완성된 URI 를 만든다.
     * UriBuilder 에 맡기면 인코딩 정책에 따라 이중 인코딩과 미인코딩이 갈린다.
     */
    private URI buildVillageForecastUri(KmaGridPoint grid, KmaBaseTime baseTime) {
        String serviceKey = kmaApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new InsightException(InsightErrorCode.WEATHER_SERVICE_KEY_MISSING);
        }

        String url = "%s/getVilageFcst?serviceKey=%s&dataType=JSON&numOfRows=%d&pageNo=1&base_date=%s&base_time=%s&nx=%d&ny=%d"
            .formatted(
                kmaApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                kmaApiProperties.numOfRows(),
                baseTime.baseDateParam(),
                baseTime.baseTimeParam(),
                grid.nx(),
                grid.ny()
            );
        return URI.create(url);
    }

    private String requestRaw(URI uri) {
        try {
            return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() ->
                openApiWebClient.get()
                    .uri(uri)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block()
            );
        } catch (CallNotPermittedException exception) {
            log.warn("KMA circuit open, skipping call");
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        } catch (WebClientResponseException exception) {
            log.warn("KMA call failed status={} body={}", exception.getStatusCode().value(),
                truncate(exception.getResponseBodyAsString()));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        } catch (InsightException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("KMA call failed reason={}", exception.getMessage());
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        }
    }

    /**
     * 정상 래퍼와 오류 응답을 분기하고 body 노드를 반환한다.
     * 데이터 없음(resultCode=03)은 오류가 아니라 빈 결과로 보고 null 을 반환해 폴백 경로에 맡긴다.
     */
    private JsonNode parseAndValidate(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return null;
        }
        // serviceKey 미등록 등은 JSON 이 아니라 OpenAPI_ServiceResponse XML 로 온다.
        String trimmed = rawBody.trim();
        if (!trimmed.startsWith("{")) {
            log.warn("KMA responded with non-JSON body={}", truncate(trimmed));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(trimmed);
        } catch (Exception exception) {
            log.warn("KMA response parse failed body={}", truncate(trimmed));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        }

        JsonNode header = root.path("response").path("header");
        if (header.isMissingNode()) {
            log.warn("KMA response missing header body={}", truncate(trimmed));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }

        String resultCode = header.path("resultCode").asText("");
        if (NO_DATA_RESULT_CODE.equals(resultCode)) {
            return null;
        }
        if (!OK_RESULT_CODE.equals(resultCode) && !OK_RESULT_CODE_TOUR_STYLE.equals(resultCode)) {
            log.warn("KMA responded with error resultCode={} resultMsg={}",
                resultCode, header.path("resultMsg").asText(""));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }
        return root.path("response").path("body");
    }

    /** items 가 빈 문자열(0건) / 단일 객체 / 배열 세 형태 모두로 오는 것을 흡수한다. */
    private List<JsonNode> extractItems(JsonNode body) {
        JsonNode items = body.path("items");
        if (items.isMissingNode() || items.isTextual() || items.isNull()) {
            return List.of();
        }
        JsonNode item = items.path("item");
        if (item.isArray()) {
            List<JsonNode> nodes = new ArrayList<>();
            item.forEach(nodes::add);
            return nodes;
        }
        if (item.isObject()) {
            return List.of(item);
        }
        return List.of();
    }

    /**
     * category 별로 흩어진 행을 예보 시각 기준으로 접는다.
     *
     * <p>이 피벗이 이 어댑터의 존재 이유다. 원본의 행 구조를 그대로 위로 올리면 application 이
     * TMP 라는 문자열을 알아야 한다.
     */
    private List<WeatherForecast> pivotByForecastTime(KmaGridPoint grid, KmaBaseTime baseTime, List<JsonNode> items) {
        Map<LocalDateTime, WeatherForecast.WeatherForecastBuilder> builders = new LinkedHashMap<>();

        for (JsonNode item : items) {
            LocalDateTime forecastAt = parseForecastAt(item.path("fcstDate").asText(""), item.path("fcstTime").asText(""));
            if (forecastAt == null) {
                continue;
            }
            WeatherForecast.WeatherForecastBuilder builder = builders.computeIfAbsent(forecastAt, key ->
                WeatherForecast.builder()
                    .nx(grid.nx())
                    .ny(grid.ny())
                    .forecastAt(key)
                    .baseAt(baseTime.publishedAt())
            );
            applyCategory(builder, item.path("category").asText(""), item.path("fcstValue").asText(""));
        }

        return builders.values().stream()
            .map(WeatherForecast.WeatherForecastBuilder::build)
            .sorted(Comparator.comparing(WeatherForecast::forecastAt))
            .toList();
    }

    private void applyCategory(WeatherForecast.WeatherForecastBuilder builder, String category, String value) {
        switch (category) {
            case "TMP" -> builder.temperature(parseDouble(value));
            case "TMN" -> builder.minTemperature(parseDouble(value));
            case "TMX" -> builder.maxTemperature(parseDouble(value));
            case "POP" -> builder.precipitationProbability(parseInteger(value));
            case "REH" -> builder.humidity(parseInteger(value));
            case "WSD" -> builder.windSpeed(parseDouble(value));
            case "PTY" -> builder.precipitationType(PrecipitationType.fromCode(value));
            case "SKY" -> builder.skyState(SkyState.fromCode(value));
            // 숫자로 파싱하면 터지는 항목. 전용 타입이 원문과 수치를 함께 들고 간다.
            case "PCP" -> builder.precipitation(PrecipitationAmount.parse(value));
            default -> {
                // UUU/VVV/VEC/WAV/SNO 등은 현재 쓰지 않는다. 원천이 항목을 늘려도 조용히 무시한다.
            }
        }
    }

    private LocalDateTime parseForecastAt(String fcstDate, String fcstTime) {
        if (fcstDate.isBlank() || fcstTime.isBlank() || fcstTime.length() < 4) {
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(fcstDate, FORECAST_DATE_FORMAT);
            // fcstTime 은 0600 처럼 정시 4자리로 온다.
            int hour = Integer.parseInt(fcstTime.substring(0, 2));
            int minute = Integer.parseInt(fcstTime.substring(2, 4));
            return LocalDateTime.of(date, LocalTime.of(hour % 24, minute));
        } catch (RuntimeException exception) {
            log.debug("KMA forecast time parse skipped fcstDate={} fcstTime={}", fcstDate, fcstTime);
            return null;
        }
    }

    private Double parseDouble(String value) {
        try {
            return Double.valueOf(value.trim());
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private Integer parseInteger(String value) {
        try {
            return Integer.valueOf(value.trim());
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private String truncate(String value) {
        if (value == null) {
            return "";
        }
        return value.length() <= RAW_BODY_LOG_LIMIT ? value : value.substring(0, RAW_BODY_LOG_LIMIT);
    }
}
