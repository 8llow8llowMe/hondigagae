package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherWarningPort;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.KmaApiProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
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
 * 같은 기상청이지만 <b>활용신청이 별개다.</b> 2026-09-01 실호출에서 단기예보는 정상인데
 * 특보만 {@code SERVICE_KEY_IS_NOT_REGISTERED} 가 왔다 - 아직 신청하지 않았다는 뜻이다.
 * 서킷을 {@code kma} 와 공유하면 <b>승인되지 않은 이 API 의 연속 실패가 예보 서킷을 열어</b>
 * 이미 잘 돌고 있는 적합도·산책 위험도까지 끌어내린다. 그래서 {@code kma-warning} 으로 나눈다.
 *
 * <h2>응답 규격이 확인되지 않았다</h2>
 *
 * 활용신청 승인 전이라 <b>실제 응답을 보지 못했다.</b> 그래서 필드명에 기대지 않는 방향으로
 * 짰다 - 특보 내용은 여러 후보 필드 중 있는 것을 이어 붙여 <b>문구에서</b> 종류와 단계를 뽑는다.
 * 필드명은 바뀔 수 있어도 "호우주의보" 같은 문구는 사람이 읽는 표기라 잘 바뀌지 않는다.
 *
 * <p><b>승인 후 반드시 다시 확인할 것</b> — 실제 응답으로 아래를 검증하고 이 주석을 갱신한다.
 * <ul>
 *   <li>발효 중 특보만 오는지, 해제분까지 섞여 오는지 (해제 여부 필드 유무)</li>
 *   <li>{@code stnId} 184(제주)로 제주 전역이 덮이는지</li>
 *   <li>발효 시각 필드명과 형식 ({@code tmFc} 가 발표시각인지 발효시각인지)</li>
 * </ul>
 *
 * <p>그때까지 이 어댑터는 <b>항상 빈 목록</b>을 준다. 실패가 기능을 멎게 하지 않는다.
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

    private static final DateTimeFormatter DATE_PARAM_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter EFFECTIVE_AT_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    /** 특보 문구가 담길 만한 필드들. 규격 확인 전이라 있는 것을 모아 쓴다. */
    private static final List<String> TEXT_FIELDS = List.of("title", "t6", "other", "warnVar", "cmd");
    private static final int RAW_BODY_LOG_LIMIT = 300;
    /** 조회 구간. 발효 중인 특보를 놓치지 않으려면 어제부터 본다. */
    private static final int LOOKBACK_DAYS = 1;

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

    private URI buildUri(String stationId) {
        LocalDate today = LocalDate.now();
        String url = "%s/getWthrWrnList?serviceKey=%s&dataType=JSON&numOfRows=%d&pageNo=1&stnId=%s&fromTmFc=%s&toTmFc=%s"
            .formatted(
                kmaApiProperties.warningBaseUrl(),
                URLEncoder.encode(kmaApiProperties.serviceKey(), StandardCharsets.UTF_8),
                kmaApiProperties.warningNumOfRows(),
                stationId,
                today.minusDays(LOOKBACK_DAYS).format(DATE_PARAM_FORMAT),
                today.format(DATE_PARAM_FORMAT)
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
     * <p>활용신청 전에는 {@code response} 가 아니라 {@code OpenAPI_ServiceResponse} 로 오므로
     * 헤더가 없어 여기서 걸린다.
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
     * 특보 문구에서 종류와 단계를 뽑는다.
     *
     * <p>필드명이 아니라 문구를 근거로 삼는 것이 요점이다 - 규격을 확인하지 못한 상태에서
     * 필드명을 찍으면 이름 하나 다를 때 조용히 0건이 된다.
     */
    private List<WeatherWarning> toWarnings(List<JsonNode> items) {
        List<WeatherWarning> warnings = new ArrayList<>();
        for (JsonNode item : items) {
            String text = joinTextFields(item);
            if (text.isBlank()) {
                continue;
            }
            warnings.add(WeatherWarning.builder()
                .type(WeatherWarningType.from(text))
                .level(WeatherWarningLevel.from(text))
                .effectiveAt(parseEffectiveAt(item))
                .sourceText(truncate(text))
                .build());
        }
        return warnings;
    }

    private String joinTextFields(JsonNode item) {
        StringBuilder joined = new StringBuilder();
        for (String field : TEXT_FIELDS) {
            String value = item.path(field).asText("");
            if (!value.isBlank()) {
                joined.append(value).append(' ');
            }
        }
        return joined.toString().trim();
    }

    private LocalDateTime parseEffectiveAt(JsonNode item) {
        String value = item.path("tmFc").asText("");
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
