package com.hondigagae.domainlayer.congestionimport.adapter.out.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.congestionimport.application.exception.CongestionImportErrorCode;
import com.hondigagae.domainlayer.congestionimport.application.exception.CongestionImportException;
import com.hondigagae.domainlayer.congestionimport.application.port.out.CongestionForecastCatalogPort;
import com.hondigagae.domainlayer.congestionimport.application.port.out.query.CongestionCatalogQueryResult;
import com.hondigagae.domainlayer.congestionimport.domain.enums.JejuLegalRegion;
import com.hondigagae.domainlayer.congestionimport.domain.model.ImportedCongestionForecast;
import com.hondigagae.global.properties.TourApiProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * 관광지 집중률 예측(TatsCnctrRateService) 어댑터.
 *
 * <p>같은 B551011 계열이라 {@code TourApiPlaceCatalogAdapter} 와 같은 함정을 방어한다 -
 * 파라미터 오류 시 flat JSON, 0건일 때 {@code items} 가 빈 문자열.
 *
 * <p><b>signguCd 는 필수다.</b> 빼면 필수 파라미터 오류가 flat JSON 으로 돌아온다
 * (data-api-analysis.md §8 실측). 그리고 이 API 가 쓰는 코드는 관광 areaCode 가 아니라
 * 법정동 코드다 ({@link JejuLegalRegion}).
 *
 * <p>관광지명 필드는 원천 문서와 실제 응답 표기가 갈릴 수 있어 {@code tAtsNm} 과 {@code tatsNm}
 * 을 모두 본다. 한쪽만 읽으면 조용히 전 행이 빈 이름으로 적재된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TatsCongestionCatalogAdapter implements CongestionForecastCatalogPort {

    private static final String OK_RESULT_CODE = "0000";
    private static final int RAW_BODY_LOG_LIMIT = 300;

    /** 서킷 인스턴스명. 관광공사 집중률 예측(TATS) 전용이다. */
    public static final String CIRCUIT_NAME = "tats";

    private final WebClient openApiWebClient;
    private final ObjectMapper objectMapper;
    private final TourApiProperties tourApiProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public CongestionCatalogQueryResult fetchConcentrationRates(JejuLegalRegion region, int pageNo, int numOfRows) {
        JsonNode body = parseAndValidate(requestRaw(buildUri(region, pageNo, numOfRows)));

        List<ImportedCongestionForecast> forecasts = new ArrayList<>();
        for (JsonNode item : extractItems(body)) {
            ImportedCongestionForecast forecast = toForecast(item, region);
            if (forecast != null) {
                forecasts.add(forecast);
            }
        }
        return new CongestionCatalogQueryResult(forecasts, pageNo, numOfRows, body.path("totalCount").asInt(0));
    }

    private URI buildUri(JejuLegalRegion region, int pageNo, int numOfRows) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new CongestionImportException(CongestionImportErrorCode.SERVICE_KEY_MISSING);
        }

        String url = "%s/TatsCnctrRateService/tatsCnctrRatedList?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&areaCd=%s&signguCd=%s&pageNo=%d&numOfRows=%d"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                region.getAreaCd(),
                region.getSignguCd(),
                pageNo,
                numOfRows
            );
        return URI.create(url);
    }

    /** 원천 호출. 서킷은 전송 호출만 감싼다 - 응답 해석 실패는 이 밖에서 일어난다. */
    private String requestRaw(URI uri) {
        try {
            return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() ->
                openApiWebClient.get().uri(uri).retrieve().bodyToMono(String.class).block()
            );
        } catch (CallNotPermittedException exception) {
            throw new CongestionImportException(CongestionImportErrorCode.API_CIRCUIT_OPEN, exception);
        } catch (WebClientResponseException exception) {
            throw new CongestionImportException(CongestionImportErrorCode.API_CALL_FAILED, exception,
                "HTTP %d".formatted(exception.getStatusCode().value()));
        } catch (RuntimeException exception) {
            throw new CongestionImportException(CongestionImportErrorCode.API_CALL_FAILED, exception,
                String.valueOf(exception.getMessage()));
        }
    }

    private JsonNode parseAndValidate(String rawBody) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawBody);
        } catch (Exception exception) {
            throw new CongestionImportException(CongestionImportErrorCode.RESPONSE_INVALID, exception, truncate(rawBody));
        }

        if (root.has("response")) {
            JsonNode header = root.path("response").path("header");
            String resultCode = header.path("resultCode").asText("");
            if (!OK_RESULT_CODE.equals(resultCode)) {
                throw new CongestionImportException(CongestionImportErrorCode.API_CALL_FAILED,
                    "%s %s".formatted(resultCode, header.path("resultMsg").asText("")));
            }
            return root.path("response").path("body");
        }
        // 파라미터 오류는 공통 래퍼가 아니라 flat JSON 으로 온다 (실측).
        if (root.has("resultCode")) {
            throw new CongestionImportException(CongestionImportErrorCode.API_CALL_FAILED,
                "%s %s".formatted(root.path("resultCode").asText(""), root.path("resultMsg").asText("")));
        }
        throw new CongestionImportException(CongestionImportErrorCode.RESPONSE_INVALID, truncate(rawBody));
    }

    /** items 가 빈 문자열(0건) / 단일 객체 / 배열 세 형태로 오는 것을 흡수한다. */
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

    private ImportedCongestionForecast toForecast(JsonNode item, JejuLegalRegion region) {
        String tatsNm = firstNonBlank(item, "tAtsNm", "tatsNm", "tAtsNm1");
        String baseYmd = firstNonBlank(item, "baseYmd", "base_ymd");
        if (tatsNm == null || baseYmd == null) {
            log.debug("Congestion row skipped, missing key fields item={}", item);
            return null;
        }

        return ImportedCongestionForecast.builder()
            .baseYmd(baseYmd)
            .areaCd(defaultIfBlank(item.path("areaCd").asText(""), region.getAreaCd()))
            .signguCd(defaultIfBlank(item.path("signguCd").asText(""), region.getSignguCd()))
            .tatsNm(tatsNm)
            .cnctrRate(item.path("cnctrRate").asDouble(0d))
            .build();
    }

    private String firstNonBlank(JsonNode item, String... fieldNames) {
        for (String fieldName : fieldNames) {
            String value = item.path(fieldName).asText("");
            if (!value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String truncate(String value) {
        if (value == null) {
            return "";
        }
        return value.length() <= RAW_BODY_LOG_LIMIT ? value : value.substring(0, RAW_BODY_LOG_LIMIT);
    }
}
