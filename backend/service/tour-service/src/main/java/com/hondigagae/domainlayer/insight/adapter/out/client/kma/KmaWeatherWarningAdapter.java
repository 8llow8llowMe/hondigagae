package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherWarningPort;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarningStatusText;
import com.hondigagae.global.properties.KmaApiProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * 기상청 기상특보 조회서비스({@code WthrWrnInfoService}) 어댑터.
 *
 * <h2>서킷을 kma 와 분리한 이유</h2>
 *
 * 같은 기상청이지만 <b>활용신청이 별개다.</b> 2026-09-01 확인 과정에서 그것이 드러났다 -
 * 같은 키로 단기예보는 정상인데 특보만 {@code SERVICE_KEY_IS_NOT_REGISTERED} 였고,
 * 별도 신청 후에야 열렸다.
 *
 * <p>신청이 갈리면 <b>승인 상태도 쿼터도 따로 움직인다.</b> 서킷을 {@code kma} 와 공유하면
 * 한쪽의 연속 실패가 다른 쪽 서킷을 열어, 멀쩡한 예보 기능까지 끌어내린다.
 * 그래서 {@code kma-warning} 으로 나눈다.
 *
 * <h2>getWthrWrnList 가 아니라 getPwnStatus 다</h2>
 *
 * 2026-09-01 실호출로 확인했다. 이름만 보면 "특보 목록"이 맞아 보이지만
 * {@code getWthrWrnList} 는 <b>통보문 이력</b>이라 해제분까지 한 행으로 온다.
 *
 * <pre>
 * [특보] 제08-108호 : 2026.08.28.10:00 / 호우주의보 해제 (*)
 * </pre>
 *
 * 이것을 발효 중으로 읽으면 <b>이미 풀린 경보로 사용자의 일정을 취소시킨다.</b>
 * {@code getPwnStatus}(특보 현황)의 {@code t6} 에 지금 살아 있는 것만 남는다.
 *
 * <h2>stnId 는 응답을 필터하지 않는다</h2>
 *
 * 제주(184)와 서울(108)에 <b>같은 전국 문구</b>가 왔다. 그래서 지역 필터는 파라미터가 아니라
 * 문구 해석에서 한다 ({@link WeatherWarningStatusText}). 빠뜨리면 전라남도 폭염주의보를
 * 제주 특보로 읽는다.
 *
 * <p>그래도 {@code stnId} 를 보내는 이유는 필수 파라미터이기 때문이다.
 *
 * <h2>확인된 응답 필드</h2>
 *
 * {@code t6}(발효 중 특보), {@code t7}·{@code other}(실측 당시 모두 {@code "o 없음"}),
 * {@code tmEf}(발효시각), {@code tmFc}(발표시각), {@code tmSeq}.
 * <b>발효시각은 {@code tmEf} 다</b> - {@code tmFc} 는 발표시각이라 둘이 다를 수 있다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaWeatherWarningAdapter implements WeatherWarningPort {

    /** 서킷 인스턴스명. 예보({@code kma})와 나눈다 - 활용신청이 별개라 실패도 따로 난다. */
    public static final String CIRCUIT_NAME = "kma-warning";

    private static final String OK_RESULT_CODE = "00";
    private static final String OK_RESULT_CODE_TOUR_STYLE = "0000";
    private static final String NO_DATA_RESULT_CODE = "03";

    private static final DateTimeFormatter EFFECTIVE_AT_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    /** 발효 중 특보가 담기는 필드. */
    private static final String ACTIVE_WARNING_FIELD = "t6";
    /** 발효시각. 발표시각({@code tmFc})과 다를 수 있어 이쪽을 쓴다. */
    private static final String EFFECTIVE_AT_FIELD = "tmEf";
    private static final int RAW_BODY_LOG_LIMIT = 300;

    private final WebClient openApiWebClient;
    private final ObjectMapper objectMapper;
    private final KmaApiProperties kmaApiProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public List<WeatherWarning> findActiveWarnings(String stationId) {
        if (!kmaApiProperties.hasWarningSupport()) {
            // 키가 없거나 기능을 꺼 둔 상태. 호출 자체를 하지 않는다.
            return List.of();
        }

        try {
            JsonNode body = parseAndValidate(requestRaw(buildUri(stationId)));
            return body == null ? List.of() : toWarnings(extractItems(body));
        } catch (RuntimeException exception) {
            // 특보 조회 실패가 적합도·산책 위험도를 멎게 하지 않는다.
            log.warn("KMA warning lookup failed stationId={} reason={}", stationId, exception.getMessage());
            return List.of();
        }
    }

    /**
     * 현황 조회 URI.
     *
     * <p>날짜 파라미터를 넣지 않는다. 현황은 <b>지금 상태의 스냅샷</b>이라 구간을 물을 필요가
     * 없고, 실호출에서도 날짜 없이 최신 한 건이 왔다. (구간을 주면 6일 제한에 걸려
     * {@code resultCode=99} 가 온다.)
     */
    private URI buildUri(String stationId) {
        String url = "%s/getPwnStatus?serviceKey=%s&dataType=JSON&numOfRows=%d&pageNo=1&stnId=%s"
            .formatted(
                kmaApiProperties.warningBaseUrl(),
                URLEncoder.encode(kmaApiProperties.serviceKey(), StandardCharsets.UTF_8),
                kmaApiProperties.warningNumOfRows(),
                stationId
            );
        return URI.create(url);
    }

    /** 서킷은 전송 호출만 감싼다 - 응답 해석 실패는 원천이 죽은 것과 다른 문제다. */
    private String requestRaw(URI uri) {
        try {
            return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() ->
                openApiWebClient.get().uri(uri).retrieve().bodyToMono(String.class).block()
            );
        } catch (CallNotPermittedException exception) {
            log.debug("KMA warning circuit open, skipping call");
            throw exception;
        }
    }

    /**
     * 정상 래퍼와 오류 응답을 분기한다.
     *
     * <p>활용신청이 풀리지 않은 키로 부르면 {@code response} 가 아니라
     * {@code OpenAPI_ServiceResponse} 로 오므로 헤더가 없어 여기서 걸린다.
     *
     * <p>조회 구간을 잘못 주면 {@code resultCode=99}("최대 조회 기간은 오늘 기준으로 6일
     * 전까지입니다")가 온다. 현황 조회는 날짜를 안 보내므로 해당되지 않지만, 오류 코드를
     * 그대로 로그에 남겨 원인을 바로 알 수 있게 한다.
     */
    private JsonNode parseAndValidate(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return null;
        }
        String trimmed = rawBody.trim();
        if (!trimmed.startsWith("{")) {
            log.warn("KMA warning responded with non-JSON body={}", truncate(trimmed));
            return null;
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(trimmed);
        } catch (Exception exception) {
            log.warn("KMA warning response parse failed body={}", truncate(trimmed));
            return null;
        }

        JsonNode header = root.path("response").path("header");
        if (header.isMissingNode()) {
            // 활용신청 미승인이 여기로 온다. 운영에서 원인을 바로 알 수 있게 본문을 남긴다.
            log.warn("KMA warning response missing header body={}", truncate(trimmed));
            return null;
        }

        String resultCode = header.path("resultCode").asText("");
        if (NO_DATA_RESULT_CODE.equals(resultCode)) {
            return null;
        }
        if (!OK_RESULT_CODE.equals(resultCode) && !OK_RESULT_CODE_TOUR_STYLE.equals(resultCode)) {
            log.warn("KMA warning responded with error resultCode={} resultMsg={}",
                resultCode, header.path("resultMsg").asText(""));
            return null;
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
        return item.isObject() ? List.of(item) : List.of();
    }

    /**
     * 현황 문구를 제주 특보로 옮긴다.
     *
     * <p>해석 자체는 {@link WeatherWarningStatusText} 가 한다 - 지역 필터가 기상청 프로토콜이
     * 아니라 <b>이 서비스가 제주만 다룬다는 도메인 사실</b>이라서다. 여기는 어느 필드를 읽을지만 안다.
     */
    private List<WeatherWarning> toWarnings(List<JsonNode> items) {
        List<WeatherWarning> warnings = new ArrayList<>();
        for (JsonNode item : items) {
            warnings.addAll(WeatherWarningStatusText.parseJejuWarnings(
                item.path(ACTIVE_WARNING_FIELD).asText(""), parseEffectiveAt(item)));
        }
        return warnings;
    }

    private LocalDateTime parseEffectiveAt(JsonNode item) {
        String value = item.path(EFFECTIVE_AT_FIELD).asText("");
        if (value.length() < 12) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.substring(0, 12), EFFECTIVE_AT_FORMAT);
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
