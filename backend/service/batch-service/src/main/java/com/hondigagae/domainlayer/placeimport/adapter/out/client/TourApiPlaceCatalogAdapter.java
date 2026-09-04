package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceCatalogQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import com.hondigagae.global.properties.TourApiProperties;
import java.math.BigDecimal;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * TourAPI(KorService2) areaBasedList2 어댑터.
 *
 * <p>실호출 검증된 응답 함정 2가지를 방어한다 (docs/data-api-analysis.md §2):
 * <ul>
 *   <li>파라미터 오류 시 공통 래퍼가 아닌 flat JSON({resultCode, resultMsg})이 온다</li>
 *   <li>결과 0건이면 items가 객체가 아니라 빈 문자열("")로 온다</li>
 * </ul>
 * 그래서 응답을 raw String으로 받아 JsonNode로 분기 파싱한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TourApiPlaceCatalogAdapter implements PlaceCatalogPort {

    private static final String OK_RESULT_CODE = "0000";
    private static final DateTimeFormatter SOURCE_DATETIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /** 서킷 인스턴스명. 제공처 단위로 분리한다 (coding-conventions §10). */
    public static final String CIRCUIT_NAME = "tourapi";

    private final WebClient openApiWebClient;
    private final ObjectMapper objectMapper;
    private final TourApiProperties tourApiProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public PlaceCatalogQueryResult fetchAreaBasedPlaces(String areaCode, PlaceContentType contentType, int pageNo, int numOfRows) {
        String rawBody = requestRaw(buildAreaBasedListUri(areaCode, contentType, pageNo, numOfRows));
        JsonNode body = parseAndValidate(rawBody);

        List<ImportedPlace> places = new ArrayList<>();
        for (JsonNode item : extractItems(body)) {
            places.add(toImportedPlace(item));
        }
        return new PlaceCatalogQueryResult(places, pageNo, numOfRows, body.path("totalCount").asInt(0));
    }

    @Override
    public List<ImportedPlaceImage> fetchDetailImages(long contentId) {
        String rawBody = requestRaw(buildDetailImageUri(contentId));
        JsonNode body = parseAndValidate(rawBody);

        List<ImportedPlaceImage> images = new ArrayList<>();
        for (JsonNode item : extractItems(body)) {
            String originImgUrl = text(item, "originimgurl");
            // URL 없는 행은 갤러리에 그릴 수 없다 — 적재 단계에서 뺀다.
            if (originImgUrl == null || originImgUrl.isBlank()) {
                continue;
            }
            images.add(ImportedPlaceImage.builder()
                .originImgUrl(originImgUrl)
                .smallImageUrl(text(item, "smallimageurl"))
                .imgName(text(item, "imgname"))
                .serialNum(text(item, "serialnum"))
                .cpyrhtDivCd(text(item, "cpyrhtDivCd"))
                .build());
        }
        return images;
    }

    /** 추가 이미지 목록. 한 콘텐츠의 이미지는 수십 장을 넘지 않아 한 페이지(100)로 충분하다. */
    private URI buildDetailImageUri(long contentId) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }
        String url = "%s/KorService2/detailImage2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&contentId=%d&imageYN=Y&pageNo=1&numOfRows=100"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                contentId
            );
        return URI.create(url);
    }

    /**
     * serviceKey는 '/'와 '=' 같은 예약 문자를 포함하므로 직접 URL 인코딩해 완성된 URI를 만든다.
     * (UriBuilder에 맡기면 인코딩 정책에 따라 이중 인코딩/미인코딩이 갈릴 수 있다)
     */
    private URI buildAreaBasedListUri(String areaCode, PlaceContentType contentType, int pageNo, int numOfRows) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }

        String url = "%s/KorService2/areaBasedList2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&areaCode=%s&contentTypeId=%s&pageNo=%d&numOfRows=%d&arrange=Q"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                areaCode,
                contentType.getCode(),
                pageNo,
                numOfRows
            );
        return URI.create(url);
    }

    /**
     * 원천 호출. 서킷은 <b>전송 호출만</b> 감싼다.
     *
     * <p>응답 해석 실패({@code parseAndValidate})는 이 밖에서 일어난다. 규격이 안 맞는 것은
     * 원천이 죽은 것과 다른 문제라 서킷을 열 이유가 없다.
     */
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
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_CIRCUIT_OPEN, exception);
        } catch (WebClientResponseException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, exception,
                "HTTP %d".formatted(exception.getStatusCode().value()));
        } catch (RuntimeException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, exception, exception.getMessage());
        }
    }

    /**
     * 정상 래퍼({response.header/body})와 flat 오류({resultCode, resultMsg})를 분기하고 body 노드를 반환한다.
     */
    private JsonNode parseAndValidate(String rawBody) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawBody);
        } catch (Exception exception) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_RESPONSE_INVALID, exception, truncate(rawBody));
        }

        if (root.has("response")) {
            JsonNode header = root.path("response").path("header");
            String resultCode = header.path("resultCode").asText("");
            if (!OK_RESULT_CODE.equals(resultCode)) {
                throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED,
                    "%s %s".formatted(resultCode, header.path("resultMsg").asText("")));
            }
            return root.path("response").path("body");
        }

        // flat 오류 응답 (예: NO_MANDATORY_REQUEST_PARAMETERS_ERROR)
        if (root.has("resultCode")) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED,
                "%s %s".formatted(root.path("resultCode").asText(""), root.path("resultMsg").asText("")));
        }
        throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_RESPONSE_INVALID, truncate(rawBody));
    }

    /**
     * items가 ""(0건) / 단일 객체 / 배열 세 형태 모두를 흡수한다.
     */
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

    private ImportedPlace toImportedPlace(JsonNode item) {
        return ImportedPlace.builder()
            .contentId(item.path("contentid").asLong())
            .contentTypeId(text(item, "contenttypeid"))
            .title(text(item, "title"))
            .addr1(text(item, "addr1"))
            .addr2(text(item, "addr2"))
            .zipcode(text(item, "zipcode"))
            .areaCode(text(item, "areacode"))
            .sigunguCode(text(item, "sigungucode"))
            .ldongRegnCd(text(item, "lDongRegnCd"))
            .ldongSignguCd(text(item, "lDongSignguCd"))
            .cat1(text(item, "cat1"))
            .cat2(text(item, "cat2"))
            .cat3(text(item, "cat3"))
            .lclsSystm1(text(item, "lclsSystm1"))
            .lclsSystm2(text(item, "lclsSystm2"))
            .lclsSystm3(text(item, "lclsSystm3"))
            // 원천은 mapx=경도, mapy=위도 — 여기서 lat/lng로 바로잡는다
            .lat(decimal(item, "mapy"))
            .lng(decimal(item, "mapx"))
            .mlevel(intValue(item, "mlevel"))
            .firstImage(text(item, "firstimage"))
            .firstImage2(text(item, "firstimage2"))
            .cpyrhtDivCd(text(item, "cpyrhtDivCd"))
            .tel(text(item, "tel"))
            .sourceCreatedAt(dateTime(item, "createdtime"))
            .sourceModifiedAt(dateTime(item, "modifiedtime"))
            .build();
    }

    private String text(JsonNode node, String field) {
        String value = node.path(field).asText("");
        return value.isBlank() ? null : value;
    }

    private BigDecimal decimal(JsonNode node, String field) {
        String value = node.path(field).asText("");
        if (value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            log.warn("invalid decimal field. field={}, value={}", field, value);
            return null;
        }
    }

    private Integer intValue(JsonNode node, String field) {
        String value = node.path(field).asText("");
        if (value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private LocalDateTime dateTime(JsonNode node, String field) {
        String value = node.path(field).asText("");
        if (value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, SOURCE_DATETIME_FORMAT);
        } catch (DateTimeParseException exception) {
            log.warn("invalid datetime field. field={}, value={}", field, value);
            return null;
        }
    }

    private String truncate(String rawBody) {
        if (rawBody == null) {
            return "null";
        }
        return rawBody.length() <= 300 ? rawBody : rawBody.substring(0, 300);
    }
}
