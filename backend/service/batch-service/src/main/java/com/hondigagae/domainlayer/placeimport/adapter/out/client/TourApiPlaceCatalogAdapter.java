package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PetTourSyncQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceCatalogQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import com.hondigagae.domainlayer.placeimport.domain.model.PetFieldParser;
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
import java.util.Optional;
import java.util.stream.Stream;
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
 *
 * <p><b>왜 areaCode 가 아니라 lDongRegnCd 로 조회하는가 (#726).</b> KorService2 가 법정동 체계로
 * 이관하면서 제주 콘텐츠의 {@code areacode}·{@code sigungucode} 를 빈 문자열로 비웠다
 * (2026-09-18 실측: {@code "areacode":"", "sigungucode":"", "lDongRegnCd":"50", "lDongSignguCd":"130"}).
 * 그 상태에서 {@code areaCode=39} 로 조회하면 구 체계가 남아 있는 행만 잡혀 제주 2,124건 중
 * 880건만 들어오고 1,244건(58.6%)이 조용히 빠진다. 그래서 <b>원천으로 나가는 쿼리 키만</b>
 * 법정동 시도코드로 옮긴다 — 잡 파라미터와 place 테이블의 적재 범위 키는 계속 관광
 * areaCode(제주=39)다.
 *
 * <p><b>반려동물 동반여행(KorPetTourService2)도 이 어댑터가 부른다 (#877).</b> 같은 제공처(B551011)·
 * 같은 키·같은 응답 래퍼라 전송·서킷({@code tourapi})·응답 분기를 그대로 쓴다. 쿼터만 다르다 —
 * 공공데이터포털은 트래픽을 <b>활용신청한 API 마다</b> 따로 세므로 KorService2 의 일 1,000건과
 * 겹치지 않는다.
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
            if (lacksContentId(item)) {
                continue;
            }
            places.add(toImportedPlace(item, areaCode));
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

    @Override
    public Optional<ImportedPlaceIntro> fetchDetailIntro(long contentId, PlaceContentType contentType) {
        String rawBody = requestRaw(buildDetailIntroUri(contentId, contentType));
        JsonNode body = parseAndValidate(rawBody);

        List<JsonNode> items = extractItems(body);
        // items="" 는 원천에 intro 가 없는 상태다 — 호출은 성공했으니 오류가 아니다.
        if (items.isEmpty()) {
            return Optional.empty();
        }
        // detailIntro2 는 콘텐츠당 한 건이다. 혹시 여러 건이 와도 첫 건만 쓴다.
        return Optional.of(TourApiIntroFieldMapper.toImportedPlaceIntro(contentType, items.get(0)));
    }

    @Override
    public List<ImportedPlace> searchPlacesByKeyword(String keyword, String areaCode) {
        String rawBody = requestRaw(buildSearchKeywordUri(keyword, areaCode));
        JsonNode body = parseAndValidate(rawBody);

        List<ImportedPlace> places = new ArrayList<>();
        for (JsonNode item : extractItems(body)) {
            if (lacksContentId(item)) {
                continue;
            }
            places.add(toImportedPlace(item, areaCode));
        }
        return places;
    }

    @Override
    public PetTourSyncQueryResult fetchPetTourSyncList(String areaCode, int pageNo, int numOfRows) {
        return toPetTourSyncResult(requestRaw(buildPetTourSyncListUri(areaCode, pageNo, numOfRows)), pageNo, numOfRows);
    }

    @Override
    public Optional<ImportedPlacePetInfo> fetchDetailPetTour(long contentId) {
        return toPlacePetInfo(requestRaw(buildDetailPetTourUri(contentId)));
    }

    /**
     * 동기화 목록 응답을 읽는다. 전송과 떼어 둔 이유는 테스트다 — 원천 형태(빈 문자열 items 등)를
     * HTTP 없이 고정한다.
     *
     * <p>contentid 가 없는 행은 버린다 — 결합할 키가 없다. {@code showflag} 는 {@code "0"} 일 때만
     * 내림으로 본다. 비었는데 내림으로 읽으면 멀쩡한 동반 정보를 지우게 된다.
     */
    PetTourSyncQueryResult toPetTourSyncResult(String rawBody, int pageNo, int numOfRows) {
        JsonNode body = parseAndValidate(rawBody);

        List<PetTourSyncQueryResult.Entry> entries = new ArrayList<>();
        for (JsonNode item : extractItems(body)) {
            long contentId = item.path("contentid").asLong(0);
            if (contentId <= 0) {
                log.warn("pet tour sync item skipped: contentid missing title={}", item.path("title").asText(""));
                continue;
            }
            boolean shown = !"0".equals(item.path("showflag").asText("").trim());
            entries.add(new PetTourSyncQueryResult.Entry(contentId, shown));
        }
        return new PetTourSyncQueryResult(entries, pageNo, numOfRows, body.path("totalCount").asInt(0));
    }

    /**
     * 동반 조건 상세 응답을 읽는다.
     *
     * <p>{@code items=""} 는 원천에 동반 정보가 없는 콘텐츠다 (2026-09-23 실측: 1839477) — 호출은
     * 성공했으니 오류가 아니다. 아이템은 왔는데 아홉 칸이 전부 비어도 같은 상태로 본다. 그 행을
     * 적재하면 장소 상세가 "동반 정보 있음" 으로 읽히는데 말해 주는 것은 하나도 없다.
     *
     * <p>원문 아홉 칸은 손대지 않는다(빈 문자열만 null 로 접는다). NOT NULL 가공 세 칸은
     * {@link PetFieldParser} 의 기존 규칙으로만 채운다 ({@link ImportedPlacePetInfo} 참고).
     */
    Optional<ImportedPlacePetInfo> toPlacePetInfo(String rawBody) {
        JsonNode body = parseAndValidate(rawBody);

        List<JsonNode> items = extractItems(body);
        if (items.isEmpty()) {
            return Optional.empty();
        }
        // detailPetTour2 는 콘텐츠당 한 건이다. 혹시 여러 건이 와도 첫 건만 쓴다 (detailIntro2 와 같은 결).
        JsonNode item = items.get(0);
        ImportedPlacePetInfo petInfo = ImportedPlacePetInfo.builder()
            .acmpyTypeCd(text(item, "acmpyTypeCd"))
            .acmpyPsblCpam(text(item, "acmpyPsblCpam"))
            .acmpyNeedMtr(text(item, "acmpyNeedMtr"))
            .etcAcmpyInfo(text(item, "etcAcmpyInfo"))
            .relaAcdntRiskMtr(text(item, "relaAcdntRiskMtr"))
            .relaFrnshPrdlst(text(item, "relaFrnshPrdlst"))
            .relaPosesFclty(text(item, "relaPosesFclty"))
            .relaPurcPrdlst(text(item, "relaPurcPrdlst"))
            .relaRntlPrdlst(text(item, "relaRntlPrdlst"))
            .allowanceScope(PetFieldParser.parseAllowanceScope(text(item, "acmpyTypeCd")))
            .allowedPetSize(PetFieldParser.parseAllowedPetSize(text(item, "acmpyPsblCpam")))
            .leashRequired(PetFieldParser.parseLeashRequired(text(item, "acmpyNeedMtr")))
            .build();
        return hasAnySourceText(petInfo) ? Optional.of(petInfo) : Optional.empty();
    }

    private boolean hasAnySourceText(ImportedPlacePetInfo petInfo) {
        return Stream.of(
                petInfo.acmpyTypeCd(), petInfo.acmpyPsblCpam(), petInfo.acmpyNeedMtr(), petInfo.etcAcmpyInfo(),
                petInfo.relaAcdntRiskMtr(), petInfo.relaFrnshPrdlst(), petInfo.relaPosesFclty(),
                petInfo.relaPurcPrdlst(), petInfo.relaRntlPrdlst())
            .anyMatch(value -> value != null);
    }

    /**
     * 동기화 목록. <b>지역은 lDongRegnCd 로 묻는다</b> — 이 서비스도 KorService2 와 같은 필드 구성이라
     * #726 의 함정이 그대로 있다. 2026-09-23 실측 {@code areaBasedList2} 는 {@code areaCode=39} 가
     * 23건, {@code lDongRegnCd=50} 이 330건이다(93% 누락). 동기화 목록도 {@code areaCode=39} 31건,
     * {@code lDongRegnCd=50} 336건이다.
     */
    URI buildPetTourSyncListUri(String areaCode, int pageNo, int numOfRows) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }
        String url = "%s/KorPetTourService2/petTourSyncList2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&lDongRegnCd=%s&pageNo=%d&numOfRows=%d"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                legalDongRegionCode(areaCode),
                pageNo,
                numOfRows
            );
        return URI.create(url);
    }

    /** 동반 조건 상세. 콘텐츠당 한 건이라 한 행(numOfRows=1)만 받는다. 서비스명의 {@code 2} 를 빼면 400 이다. */
    URI buildDetailPetTourUri(long contentId) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }
        String url = "%s/KorPetTourService2/detailPetTour2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&contentId=%d&pageNo=1&numOfRows=1"
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
     * contentid 없는 행은 적재하지 않는다 — asLong() 기본값 0 으로 흘리면 그런 행들이 전부
     * id=0 / source_key="0" 한 행으로 수렴해 서로 덮어쓴다.
     */
    private boolean lacksContentId(JsonNode item) {
        if (item.path("contentid").asLong(0) > 0) {
            return false;
        }
        log.warn("tour api item skipped: contentid missing title={}", item.path("title").asText(""));
        return true;
    }

    /** 키워드 검색. 백필 매칭은 상위 소수만 보면 되므로 한 페이지(10)로 자른다. */
    URI buildSearchKeywordUri(String keyword, String areaCode) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }
        String url = "%s/KorService2/searchKeyword2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&keyword=%s&lDongRegnCd=%s&pageNo=1&numOfRows=10&arrange=Q"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                URLEncoder.encode(keyword, StandardCharsets.UTF_8),
                legalDongRegionCode(areaCode)
            );
        return URI.create(url);
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
     * 상세 소개. 콘텐츠당 한 건이라 한 행(numOfRows=1)만 받는다.
     * contentTypeId 는 필수 파라미터다 — 빼면 flat 오류 응답이 온다.
     */
    private URI buildDetailIntroUri(long contentId, PlaceContentType contentType) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }
        String url = "%s/KorService2/detailIntro2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&contentId=%d&contentTypeId=%s&pageNo=1&numOfRows=1"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                contentId,
                contentType.getCode()
            );
        return URI.create(url);
    }

    /**
     * serviceKey는 '/'와 '=' 같은 예약 문자를 포함하므로 직접 URL 인코딩해 완성된 URI를 만든다.
     * (UriBuilder에 맡기면 인코딩 정책에 따라 이중 인코딩/미인코딩이 갈릴 수 있다)
     */
    URI buildAreaBasedListUri(String areaCode, PlaceContentType contentType, int pageNo, int numOfRows) {
        String serviceKey = tourApiProperties.serviceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
        }

        String url = "%s/KorService2/areaBasedList2?serviceKey=%s&MobileOS=%s&MobileApp=%s&_type=json&lDongRegnCd=%s&contentTypeId=%s&pageNo=%d&numOfRows=%d&arrange=Q"
            .formatted(
                tourApiProperties.baseUrl(),
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                tourApiProperties.mobileOs(),
                tourApiProperties.mobileApp(),
                legalDongRegionCode(areaCode),
                contentType.getCode(),
                pageNo,
                numOfRows
            );
        return URI.create(url);
    }

    /**
     * 잡이 준 관광 areaCode 를 원천 조회용 법정동 시도코드로 옮긴다.
     *
     * <p>모르는 지역이면 <b>즉시 실패</b>시킨다. 여기서 null 을 흘려 지역 파라미터가 빠지면
     * 원천은 오류가 아니라 전국 목록으로 답한다 — 조용히 전국을 적재하고 delist 까지 도는 것이
     * 잡이 빨갛게 끝나는 것보다 훨씬 나쁘다.
     */
    private String legalDongRegionCode(String areaCode) {
        String legalDongRegionCode = RegionCodeMapping.toLegalDongRegionCode(areaCode);
        if (legalDongRegionCode == null) {
            throw new PlaceImportException(PlaceImportErrorCode.REGION_NOT_SUPPORTED, areaCode);
        }
        return legalDongRegionCode;
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
                throw callFailed(resultCode, header.path("resultMsg").asText(""));
            }
            return root.path("response").path("body");
        }

        // flat 오류 응답 (예: NO_MANDATORY_REQUEST_PARAMETERS_ERROR)
        if (root.has("resultCode")) {
            throw callFailed(root.path("resultCode").asText(""), root.path("resultMsg").asText(""));
        }
        throw new PlaceImportException(PlaceImportErrorCode.TOUR_API_RESPONSE_INVALID, truncate(rawBody));
    }

    /**
     * 오류 본문을 도메인 예외로 옮긴다.
     *
     * <p><b>일일 한도 초과만 따로 구분한다.</b> 포털은 한도 초과도 HTTP 200 + 오류 본문으로
     * 답하므로 서킷이 세지 않는다. 이 실패는 "이 장소만 실패"가 아니라 "오늘은 더 못 부른다"는
     * 뜻이라, 장소 단위로 넘기며 계속 도는 호출부가 그것을 알아야 한다 —
     * 모르면 남은 대상 전부를 실패로 기록하며 헛돈다.
     */
    private PlaceImportException callFailed(String resultCode, String resultMsg) {
        String detail = "%s %s".formatted(resultCode, resultMsg);
        if (TourApiResultCodes.quotaExceeded(resultCode, resultMsg)) {
            return new PlaceImportException(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED, detail);
        }
        return new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, detail);
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

    /**
     * 원천 아이템을 적재 모델로 옮긴다.
     *
     * <p>{@code areaCode}·{@code sigunguCode} 는 <b>원천 값을 먼저 쓰고 비었을 때만</b> 채운다.
     * 구 체계가 남아 있는 행은 원천이 준 값이 정본이고, 이관된 행만 보충이 필요하기 때문이다.
     *
     * <p>비었을 때 {@code areaCode} 를 <b>요청 scope 로</b> 메우는 이유 — {@code place.area_code}
     * 는 단순한 원천 필드가 아니라 <b>적재 범위 키</b>다. delist({@code WHERE source=? AND
     * area_code=?})·merge 후보 조회·읽기 API 의 지역 필터가 전부 이 값을 본다. 비워 두면 새로
     * 들어온 행이 그 셋 모두에서 보이지 않아, 적재는 됐는데 사용자에게는 없는 장소가 된다.
     * {@code CultureFacilityCsvAdapter}·{@code MfdsPetRestaurantXlsxAdapter} 가 이미
     * {@link RegionCodeMapping} 으로 환산한 scope 값을 넣고 있고, 이 경로만 원천 필드를 그대로
     * 믿고 있었다 (#726).
     *
     * <p>{@code ldongRegnCd}/{@code ldongSignguCd} 는 원천 값 그대로 둔다 — 환산의 근거가 되는
     * 원본이라 보존해야 나중에 매핑이 틀렸을 때 되짚을 수 있다.
     */
    ImportedPlace toImportedPlace(JsonNode item, String scopeAreaCode) {
        String sourceAreaCode = text(item, "areacode");
        String sourceSigunguCode = text(item, "sigungucode");
        return ImportedPlace.builder()
            .contentId(item.path("contentid").asLong())
            .contentTypeId(text(item, "contenttypeid"))
            .title(text(item, "title"))
            .addr1(text(item, "addr1"))
            .addr2(text(item, "addr2"))
            .zipcode(text(item, "zipcode"))
            .areaCode(sourceAreaCode != null ? sourceAreaCode : scopeAreaCode)
            .sigunguCode(sourceSigunguCode != null
                ? sourceSigunguCode
                : RegionCodeMapping.toSigunguCodeFromLegalDong(text(item, "lDongSignguCd")))
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
