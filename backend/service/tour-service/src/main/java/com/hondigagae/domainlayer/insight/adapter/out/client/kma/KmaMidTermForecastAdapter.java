package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.port.out.MidTermForecastPort;
import com.hondigagae.domainlayer.insight.application.port.out.query.MidTermForecastQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.MidTermRegion;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.MidTermWeatherText;
import com.hondigagae.global.properties.KmaApiProperties;
import com.hondigagae.shared.travel.insight.ForecastSource;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * 기상청 중기예보 어댑터. 단기예보가 닿지 않는 날짜(대략 D+5 ~ D+10)를 메운다.
 *
 * <p>단기예보 어댑터와 형태가 크게 다르다. 그 차이가 이 클래스의 존재 이유다.
 *
 * <p><b>1. 오퍼레이션이 둘이고 코드 체계도 둘이다.</b>
 * <ul>
 *   <li>{@code getMidLandFcst} — 날씨/강수확률. 예보구역코드(도 단위)</li>
 *   <li>{@code getMidTa} — 최고/최저기온. 지점번호(제주/서귀포로 갈림)</li>
 * </ul>
 * 둘을 각각 받아 날짜로 조인해야 하루가 완성된다. 한쪽만 성공해도 채울 수 있는 것은 채운다 -
 * 기온만 있어도 더위/추위 판정은 성립한다.
 *
 * <p><b>2. 응답이 날짜별 행이 아니다.</b> 한 행에 일차가 필드명으로 박혀 온다.
 * <pre>
 * { "regId":"11G00000", "rnSt4Am":60, "rnSt4Pm":60, "rnSt8":30,
 *   "wf4Am":"흐리고 비", "wf4Pm":"흐리고 비", "wf8":"구름많음" }
 * </pre>
 * 그래서 일차를 돌며 필드명을 조립해 꺼낸다. 8일차 이후는 오전/오후 구분이 없어
 * 접미사 없는 필드({@code wf8})가 오는데, 양쪽 형태를 모두 시도한다.
 *
 * <p><b>3. 날씨가 코드가 아니라 문장이다.</b> {@link MidTermWeatherText} 가 해석한다.
 *
 * <p><b>2026-08-27 실호출로 검증했다.</b> 예보구역 코드 셋(육상 11G00000, 기온 11G00201/11G00401)이
 * 모두 유효하고, 기온은 제주 32도 / 서귀포 31도로 실제로 갈렸다. 필드명과 오전/오후 구분 경계도
 * 위 예시대로 확인했다.
 *
 * <p>그래도 0건일 때 어느 파라미터로 물었는지 로그에 남긴다. 코드가 틀리면 오류가 아니라
 * 빈 응답이 오는데, 그것을 조용히 "예보 없음"으로 넘기면 원인을 찾을 수 없다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaMidTermForecastAdapter implements MidTermForecastPort {

    /** 단기예보와 같은 제공처라 서킷 인스턴스를 공유한다. 쿼터도 함께 걸린다. */
    private static final String CIRCUIT_NAME = KmaVillageForecastAdapter.CIRCUIT_NAME;

    private static final String OK_RESULT_CODE = "00";
    private static final String OK_RESULT_CODE_TOUR_STYLE = "0000";
    private static final String NO_DATA_RESULT_CODE = "03";

    /**
     * 훑을 일차 범위.
     *
     * <p><b>첫 일차가 회차마다 다르다.</b> 실측하니 06시 회차는 4일차부터, 18시 회차는
     * 5일차부터 왔다. 발표일이 하루 차이라 <b>실제 첫 예보일은 같다</b>(오늘+4).
     * 그래서 넉넉히 3일차부터 훑고 없는 일차는 조용히 건너뛴다 - 원천이 범위를 바꿔도 버틴다.
     */
    private static final int FIRST_DAY_OFFSET = 3;
    private static final int LAST_DAY_OFFSET = 10;

    private static final int RAW_BODY_LOG_LIMIT = 300;

    private final WebClient openApiWebClient;
    private final ObjectMapper objectMapper;
    private final KmaApiProperties kmaApiProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public MidTermForecastQueryResult fetchMidTermForecast(MidTermRegion region) {
        int publishDelayMinutes = kmaApiProperties.midTermPublishDelayMinutes();
        KmaMidTermBaseTime baseTime = KmaMidTermBaseTime.latestAvailable(LocalDateTime.now(), publishDelayMinutes);

        List<DailyWeather> dailies = request(region, baseTime);
        if (!dailies.isEmpty()) {
            return toQueryResult(dailies, baseTime, publishDelayMinutes);
        }

        // 회차 직후에는 데이터가 아직 올라오지 않았을 수 있다. 한 단계만 물러서서 재시도한다.
        KmaMidTermBaseTime fallback = baseTime.previous();
        log.info("KMA mid-term forecast empty, retrying previous base region={} tmFc={} fallbackTmFc={}",
            region.getDisplayName(), baseTime.tmFcParam(), fallback.tmFcParam());
        return toQueryResult(request(region, fallback), fallback, publishDelayMinutes);
    }

    private MidTermForecastQueryResult toQueryResult(
        List<DailyWeather> dailies, KmaMidTermBaseTime baseTime, int publishDelayMinutes
    ) {
        return MidTermForecastQueryResult.builder()
            .dailies(dailies)
            .nextPublishAt(baseTime.nextAvailableAt(publishDelayMinutes))
            .build();
    }

    /**
     * 육상예보와 기온을 각각 받아 날짜로 조인한다.
     *
     * <p>한쪽 실패를 전체 실패로 만들지 않는다. 기온만 받아도 더위/추위 근거는 남고,
     * 육상예보만 받아도 강수 근거는 남는다. 둘 다 없을 때만 빈 결과다.
     */
    private List<DailyWeather> request(MidTermRegion region, KmaMidTermBaseTime baseTime) {
        JsonNode landItem = fetchItemOrNull(
            "getMidLandFcst", region.getLandRegId(), baseTime, region.getDisplayName());
        JsonNode temperatureItem = fetchItemOrNull(
            "getMidTa", region.getTemperatureRegId(), baseTime, region.getDisplayName());

        if (landItem == null && temperatureItem == null) {
            return List.of();
        }

        Map<LocalDate, DailyWeather.DailyWeatherBuilder> builders = new LinkedHashMap<>();
        for (int dayOffset = FIRST_DAY_OFFSET; dayOffset <= LAST_DAY_OFFSET; dayOffset++) {
            LocalDate date = baseTime.dateOfDayOffset(dayOffset);
            DailyWeather.DailyWeatherBuilder builder = DailyWeather.builder()
                .date(date)
                .source(ForecastSource.MID_TERM)
                // 중기예보에는 시각별/습도/풍속이 없다. 0 으로 채우지 않고 비운다.
                .hourly(List.of());

            boolean filled = false;
            filled |= applyLand(builder, landItem, dayOffset);
            filled |= applyTemperature(builder, temperatureItem, dayOffset);
            if (filled) {
                builders.put(date, builder);
            }
        }

        List<DailyWeather> dailies = builders.values().stream()
            .map(DailyWeather.DailyWeatherBuilder::build)
            .toList();
        if (dailies.isEmpty()) {
            log.warn("KMA mid-term forecast parsed 0 days region={} landRegId={} taRegId={} tmFc={}",
                region.getDisplayName(), region.getLandRegId(), region.getTemperatureRegId(), baseTime.tmFcParam());
        }
        return dailies;
    }

    /**
     * 육상예보에서 그 일차의 날씨/강수확률을 채운다.
     *
     * <p>오전/오후 중 <b>나쁜 쪽</b>을 취한다. 하루 중 반나절만 비가 와도 야외 일정에는
     * 그 반나절이 문제이기 때문이다 - 단기예보에서 "가장 나쁜 값"을 대표로 삼은 것과 같은 규칙이다.
     */
    private boolean applyLand(DailyWeather.DailyWeatherBuilder builder, JsonNode item, int dayOffset) {
        if (item == null) {
            return false;
        }
        // 8일차 이후는 오전/오후 구분이 없어 접미사 없는 필드가 온다. 양쪽을 모두 시도한다.
        Integer amRain = readInteger(item, "rnSt%dAm".formatted(dayOffset));
        Integer pmRain = readInteger(item, "rnSt%dPm".formatted(dayOffset));
        Integer flatRain = readInteger(item, "rnSt%d".formatted(dayOffset));
        Integer worstRain = maxOf(maxOf(amRain, pmRain), flatRain);

        String amText = readText(item, "wf%dAm".formatted(dayOffset));
        String pmText = readText(item, "wf%dPm".formatted(dayOffset));
        String flatText = readText(item, "wf%d".formatted(dayOffset));
        String worstText = worstWeatherText(amText, pmText, flatText);

        if (worstRain == null && worstText == null) {
            return false;
        }
        builder.maxPrecipitationProbability(worstRain);
        if (worstText != null) {
            builder.representativeSkyState(MidTermWeatherText.toSkyState(worstText));
            builder.worstPrecipitationType(MidTermWeatherText.toPrecipitationType(worstText));
        }
        return true;
    }

    private boolean applyTemperature(DailyWeather.DailyWeatherBuilder builder, JsonNode item, int dayOffset) {
        if (item == null) {
            return false;
        }
        Double min = readDouble(item, "taMin%d".formatted(dayOffset));
        Double max = readDouble(item, "taMax%d".formatted(dayOffset));
        if (min == null && max == null) {
            return false;
        }
        builder.minTemperature(min).maxTemperature(max);
        return true;
    }

    /**
     * 오전/오후 문장 중 젖는 쪽을 고른다. 둘 다 마르면 하늘이 더 나쁜 쪽을 고른다.
     */
    private String worstWeatherText(String... texts) {
        String fallback = null;
        for (String text : texts) {
            if (text == null || text.isBlank()) {
                continue;
            }
            if (MidTermWeatherText.toPrecipitationType(text).isWet()) {
                return text;
            }
            if (fallback == null) {
                fallback = text;
            }
        }
        return fallback;
    }

    /**
     * 한 오퍼레이션을 호출해 첫 item 을 준다. 실패하면 예외 대신 null 이다 -
     * 한쪽 실패가 전체를 막지 않게 하기 위해서다.
     */
    private JsonNode fetchItemOrNull(
        String operation, String regId, KmaMidTermBaseTime baseTime, String regionName
    ) {
        try {
            JsonNode body = parseAndValidate(requestRaw(buildUri(operation, regId, baseTime)));
            if (body == null) {
                return null;
            }
            List<JsonNode> items = extractItems(body);
            return items.isEmpty() ? null : items.get(0);
        } catch (InsightException exception) {
            log.warn("KMA mid-term operation failed operation={} region={} regId={} errorCode={}",
                operation, regionName, regId, exception.getErrorCode().getCode());
            return null;
        }
    }

    /**
     * serviceKey 는 슬래시와 등호 같은 예약 문자를 포함하므로 직접 인코딩해 완성된 URI 를 만든다.
     * 단기예보와 달리 발표시각이 {@code tmFc} 한 파라미터다.
     */
    private URI buildUri(String operation, String regId, KmaMidTermBaseTime baseTime) {
        String serviceKey = kmaApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new InsightException(InsightErrorCode.WEATHER_SERVICE_KEY_MISSING);
        }

        String url = "%s/%s?serviceKey=%s&dataType=JSON&numOfRows=10&pageNo=1&regId=%s&tmFc=%s"
            .formatted(
                kmaApiProperties.midTermBaseUrl(),
                operation,
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                regId,
                baseTime.tmFcParam()
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
            log.warn("KMA circuit open, skipping mid-term call");
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        } catch (WebClientResponseException exception) {
            log.warn("KMA mid-term call failed status={} body={}", exception.getStatusCode().value(),
                truncate(exception.getResponseBodyAsString()));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        } catch (InsightException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("KMA mid-term call failed reason={}", exception.getMessage());
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        }
    }

    /** 단기예보와 같은 함정(비 JSON 오류, resultCode 차이, 데이터 없음)을 같은 방식으로 흡수한다. */
    private JsonNode parseAndValidate(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return null;
        }
        String trimmed = rawBody.trim();
        if (!trimmed.startsWith("{")) {
            log.warn("KMA mid-term responded with non-JSON body={}", truncate(trimmed));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(trimmed);
        } catch (Exception exception) {
            log.warn("KMA mid-term response parse failed body={}", truncate(trimmed));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE, exception);
        }

        JsonNode header = root.path("response").path("header");
        if (header.isMissingNode()) {
            log.warn("KMA mid-term response missing header body={}", truncate(trimmed));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }

        String resultCode = header.path("resultCode").asText("");
        if (NO_DATA_RESULT_CODE.equals(resultCode)) {
            return null;
        }
        if (!OK_RESULT_CODE.equals(resultCode) && !OK_RESULT_CODE_TOUR_STYLE.equals(resultCode)) {
            log.warn("KMA mid-term responded with error resultCode={} resultMsg={}",
                resultCode, header.path("resultMsg").asText(""));
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }
        return root.path("response").path("body");
    }

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

    private String readText(JsonNode item, String fieldName) {
        String value = item.path(fieldName).asText("");
        return value.isBlank() ? null : value.trim();
    }

    private Integer readInteger(JsonNode item, String fieldName) {
        JsonNode node = item.path(fieldName);
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        try {
            return Integer.valueOf(node.asText().trim());
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private Double readDouble(JsonNode item, String fieldName) {
        JsonNode node = item.path(fieldName);
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        try {
            double value = Double.parseDouble(node.asText().trim());
            // 원천이 값 없음을 -999 로 주는 경우가 있다. 그대로 두면 영하 999도가 된다.
            return value <= -900d ? null : value;
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private Integer maxOf(Integer left, Integer right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return Math.max(left, right);
    }

    private String truncate(String value) {
        if (value == null) {
            return "";
        }
        return value.length() <= RAW_BODY_LOG_LIMIT ? value : value.substring(0, RAW_BODY_LOG_LIMIT);
    }
}
