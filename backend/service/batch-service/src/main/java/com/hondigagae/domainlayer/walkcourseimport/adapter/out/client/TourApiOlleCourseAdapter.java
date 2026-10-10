package com.hondigagae.domainlayer.walkcourseimport.adapter.out.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCoordinatePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCoordinateQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseParser;
import com.hondigagae.global.properties.TourApiProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * TourAPI(KorService2) searchKeyword2 로 올레 코스의 시작점 좌표를 얻는 어댑터.
 *
 * <p>올레 코스는 레포츠(contentTypeId=28)로 등록돼 있고 title 이 "[제주올레 3-A코스] ..." 형식이라
 * 코스번호로 매칭된다. <b>{@code lDongRegnCd=50} 기준 실측 33건</b>(코스 29 + 하영올레 등) -
 * 하영올레처럼 제주올레가 아닌 항목은 {@code OlleCourseParser.courseKeyFromTourTitle} 이 걸러낸다.
 * 같은 조회를 구 {@code areaCode=39} 로 하면 3건만 나온다 (#722·#726).
 *
 * <p>응답 함정(flat 오류·items 빈 문자열) 방어는 {@code TourApiPlaceCatalogAdapter} 와 같다.
 * 서킷 인스턴스도 같은 "tourapi" 를 쓴다 - 제공처 단위로 나누는 규칙(coding-conventions §10)이라
 * 같은 원천이 죽었으면 이 어댑터도 부르지 않아야 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TourApiOlleCourseAdapter implements OlleCourseCoordinatePort {

    private static final String OK_RESULT_CODE = "0000";
    private static final String CIRCUIT_NAME = "tourapi";
    private static final String KEYWORD = "올레";
    /**
     * 제주 법정동 시도코드. TourAPI 가 법정동 체계로 이관하며 상당수 항목의 {@code areacode} 를
     * 비워서 구 지역코드(39)로는 33건 중 3건만 잡힌다 (#722·#726).
     *
     * <p>{@code placeimport} 에도 같은 매핑이 있지만 가져다 쓰지 않는다 - {@code walkcourseimport}
     * 는 그 컨텍스트를 전혀 참조하지 않는 별개 적재 흐름이고, 한 상수 때문에 컨텍스트 경계를
     * 넘으면 두 적재가 서로의 변경에 묶인다.
     */
    private static final String JEJU_LEGAL_DONG_REGION_CODE = "50";
    private static final String LEPORTS_CONTENT_TYPE_ID = "28";

    private final WebClient openApiWebClient;
    private final ObjectMapper objectMapper;
    private final TourApiProperties tourApiProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public Map<String, OlleCourseCoordinateQueryResult> fetchCoordinatesByCourseKey() {
        String rawBody = requestRaw(buildSearchKeywordUri());
        Map<String, OlleCourseCoordinateQueryResult> coordinates = toCoordinatesByCourseKey(parseAndValidate(rawBody));
        log.info("olle course coordinates fetched. matched={}", coordinates.size());
        return coordinates;
    }

    /** 응답 body(items) → 코스키별 좌표. 실호출 없이 매핑만 검증할 수 있게 분리해 둔다. */
    Map<String, OlleCourseCoordinateQueryResult> toCoordinatesByCourseKey(JsonNode body) {
        Map<String, OlleCourseCoordinateQueryResult> coordinates = new HashMap<>();
        for (JsonNode item : extractItems(body)) {
            String courseKey = OlleCourseParser.courseKeyFromTourTitle(item.path("title").asText(null));
            if (courseKey == null) {
                continue;
            }
            // TourAPI 는 mapx=경도, mapy=위도다. 뒤집으면 제주 좌표가 바다 한가운데로 간다.
            Double lng = doubleOf(item, "mapx");
            Double lat = doubleOf(item, "mapy");
            // 좌표 없는 항목은 매칭해도 쓸 것이 없다 - 넣지 않아야 프로세서가 "매칭 실패"로 정직하게 남긴다.
            if (lat == null || lng == null) {
                continue;
            }
            coordinates.put(courseKey, OlleCourseCoordinateQueryResult.builder()
                .lat(lat)
                .lng(lng)
                .contentId(item.path("contentid").asLong(0) == 0 ? null : item.path("contentid").asLong())
                .firstImage(blankToNull(item.path("firstimage").asText(null)))
                .build());
        }
        return coordinates;
    }

    /**
     * 올레 항목은 33건 안팎이라 한 페이지(100)로 충분하다.
     *
     * <p><b>{@code arrange} 를 넣지 않는다.</b> TourAPI 의 {@code arrange=A/C/D} 는 정렬이 아니라
     * "대표이미지 있는 것만" 필터다. 지금은 올레 항목이 전부 이미지를 갖고 있어 아무것도 걸러내지
     * 않지만, 이미지 없는 코스가 등록되는 날 오류 없이 목록에서 사라진다. 한 페이지에 다 들어오는
     * 조회라 정렬을 지정하지 않아도 결과 집합은 같다.
     */
    URI buildSearchKeywordUri() {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }
        String url = "%s/KorService2/searchKeyword2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&keyword=%s&lDongRegnCd=%s&contentTypeId=%s&pageNo=1&numOfRows=100"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                URLEncoder.encode(KEYWORD, StandardCharsets.UTF_8),
                JEJU_LEGAL_DONG_REGION_CODE,
                LEPORTS_CONTENT_TYPE_ID
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
            throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_CIRCUIT_OPEN, exception);
        } catch (WebClientResponseException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_CALL_FAILED, exception,
                "HTTP %d".formatted(exception.getStatusCode().value()));
        } catch (RuntimeException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_CALL_FAILED, exception, exception.getMessage());
        }
    }

    private JsonNode parseAndValidate(String rawBody) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawBody);
        } catch (Exception exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_RESPONSE_INVALID, exception, truncate(rawBody));
        }

        if (root.has("response")) {
            JsonNode header = root.path("response").path("header");
            String resultCode = header.path("resultCode").asText("");
            if (!OK_RESULT_CODE.equals(resultCode)) {
                throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_CALL_FAILED,
                    "%s %s".formatted(resultCode, header.path("resultMsg").asText("")));
            }
            return root.path("response").path("body");
        }
        if (root.has("resultCode")) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_CALL_FAILED,
                "%s %s".formatted(root.path("resultCode").asText(""), root.path("resultMsg").asText("")));
        }
        throw new WalkCourseImportException(WalkCourseImportErrorCode.TOUR_API_RESPONSE_INVALID, truncate(rawBody));
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

    private Double doubleOf(JsonNode item, String field) {
        String text = item.path(field).asText(null);
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(text);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String truncate(String rawBody) {
        if (rawBody == null) {
            return "null";
        }
        return rawBody.length() <= 200 ? rawBody : rawBody.substring(0, 200);
    }
}
