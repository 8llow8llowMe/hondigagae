package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import com.hondigagae.global.properties.TourApiProperties;
import java.net.URI;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 원천으로 나가는 지역 쿼리 키와, 비어 오는 지역 필드의 보충을 고정한다 (#726).
 *
 * <p><b>실제 TourAPI 에 요청을 보내지 않는다.</b> 여기서 고정하는 것은 HTTP 가 아니라
 * "무엇을 물어보고, 받은 아이템을 어떻게 읽는가"다 — {@code DataGoKrCultureFacilitySourceAdapterTest}
 * 와 같은 방식으로 URI 조립과 매핑만 떼어 본다. 이 어댑터에 테스트가 없어서 areaCode 로 묻던
 * 시절의 58.6% 누락이 CI 를 그대로 통과했다.
 *
 * <p>픽스처는 2026-09-18 실측 아이템의 지역 필드를 옮긴 것이다.
 */
class TourApiPlaceCatalogAdapterTest {

    private static final String JEJU_AREA_CODE = "39";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /** WebClient·서킷은 이 경로에서 쓰이지 않는다 — URI 조립과 매핑은 설정값과 아이템만 본다. */
    private static TourApiPlaceCatalogAdapter adapter() {
        return new TourApiPlaceCatalogAdapter(null, OBJECT_MAPPER,
            new TourApiProperties("https://apis.data.go.kr/B551011", "test-service-key", "ETC", "hondigagae"), null);
    }

    private static JsonNode item(String json) {
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (Exception exception) {
            throw new IllegalStateException("fixture parse failed", exception);
        }
    }

    @Nested
    @DisplayName("지역 쿼리 키")
    class RegionQueryKey {

        @Test
        @DisplayName("목록 조회는 areaCode 가 아니라 lDongRegnCd 로 묻는다")
        void areaBasedListAsksByLegalDongRegionCode() {
            URI uri = adapter().buildAreaBasedListUri(JEJU_AREA_CODE, PlaceContentType.TOURIST_SPOT, 1, 100);

            assertThat(uri.toString()).contains("lDongRegnCd=50");
            // 원천이 제주 콘텐츠의 areacode 를 비웠으므로 이 키로 물으면 절반만 온다.
            assertThat(uri.toString()).doesNotContain("areaCode=");
        }

        @Test
        @DisplayName("키워드 검색도 lDongRegnCd 로 묻는다 — 백필 후보가 같은 범위에서 나와야 한다")
        void searchKeywordAsksByLegalDongRegionCode() {
            URI uri = adapter().buildSearchKeywordUri("달빛카페", JEJU_AREA_CODE);

            assertThat(uri.toString()).contains("lDongRegnCd=50");
            assertThat(uri.toString()).doesNotContain("areaCode=");
        }

        @Test
        @DisplayName("나머지 파라미터는 그대로다 — 이번 변경은 지역 키 하나뿐이다")
        void keepsOtherParameters() {
            URI uri = adapter().buildAreaBasedListUri(JEJU_AREA_CODE, PlaceContentType.RESTAURANT, 3, 100);

            assertThat(uri.toString())
                .contains("contentTypeId=39")
                .contains("pageNo=3")
                .contains("numOfRows=100")
                .contains("arrange=Q")
                .contains("_type=json");
        }

        @Test
        @DisplayName("매핑에 없는 지역코드는 REGION_NOT_SUPPORTED 로 즉시 막는다 — 전국 조회로 새면 안 된다")
        void rejectsUnknownAreaCode() {
            // 지역 파라미터가 빠지면 원천은 오류가 아니라 전국 목록으로 답한다. 조용히 전국을
            // 적재하고 delist 까지 도는 것이 잡이 빨갛게 끝나는 것보다 훨씬 나쁘다.
            assertThatThrownBy(() -> adapter().buildAreaBasedListUri("41", PlaceContentType.TOURIST_SPOT, 1, 100))
                .isInstanceOf(PlaceImportException.class)
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.REGION_NOT_SUPPORTED);

            assertThatThrownBy(() -> adapter().buildSearchKeywordUri("달빛카페", "41"))
                .isInstanceOf(PlaceImportException.class)
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.REGION_NOT_SUPPORTED);
        }
    }

    @Nested
    @DisplayName("비어 오는 지역 필드 보충")
    class RegionFieldFallback {

        @Test
        @DisplayName("areacode·sigungucode 가 비면 요청 scope 와 법정동 시군구코드로 메운다")
        void fillsBlankRegionFieldsFromScopeAndLegalDong() {
            // 2026-09-18 실측: 이관된 제주 콘텐츠는 두 필드를 빈 문자열로 준다.
            JsonNode item = item("""
                {"contentid":"2612345","contenttypeid":"12","title":"서귀포 어느 장소",
                 "areacode":"","sigungucode":"","lDongRegnCd":"50","lDongSignguCd":"130"}
                """);

            ImportedPlace place = adapter().toImportedPlace(item, JEJU_AREA_CODE);

            // area_code 는 적재 범위 키다 — 비워 두면 delist·merge·읽기 필터에서 전부 사라진다.
            assertThat(place.areaCode()).isEqualTo("39");
            assertThat(place.sigunguCode()).isEqualTo("3");
            // 환산의 근거가 되는 원본은 그대로 남긴다.
            assertThat(place.ldongRegnCd()).isEqualTo("50");
            assertThat(place.ldongSignguCd()).isEqualTo("130");
        }

        @Test
        @DisplayName("제주시(110)는 관광 시군구코드 4 로 옮긴다")
        void mapsJejuSiLegalDongCode() {
            JsonNode item = item("""
                {"contentid":"2612346","areacode":"","sigungucode":"","lDongRegnCd":"50","lDongSignguCd":"110"}
                """);

            assertThat(adapter().toImportedPlace(item, JEJU_AREA_CODE).sigunguCode()).isEqualTo("4");
        }

        @Test
        @DisplayName("구 체계가 남아 있는 행은 원천 값을 그대로 쓴다 — 보충은 비었을 때만이다")
        void keepsSourceValuesWhenPresent() {
            JsonNode item = item("""
                {"contentid":"2612347","areacode":"39","sigungucode":"4","lDongRegnCd":"50","lDongSignguCd":"130"}
                """);

            ImportedPlace place = adapter().toImportedPlace(item, JEJU_AREA_CODE);

            // 원천이 준 값이 정본이다. lDongSignguCd 로 덮어쓰면 4 가 3 으로 바뀐다.
            assertThat(place.areaCode()).isEqualTo("39");
            assertThat(place.sigunguCode()).isEqualTo("4");
        }

        @Test
        @DisplayName("법정동 시군구코드까지 없으면 sigunguCode 는 null — 없는 값을 지어내지 않는다")
        void leavesSigunguCodeNullWhenNothingToMapFrom() {
            JsonNode item = item("""
                {"contentid":"2612348","areacode":"","sigungucode":"","lDongRegnCd":"50"}
                """);

            ImportedPlace place = adapter().toImportedPlace(item, JEJU_AREA_CODE);

            assertThat(place.areaCode()).isEqualTo("39");
            assertThat(place.sigunguCode()).isNull();
        }
    }

    /**
     * 관광정보 음식점 행의 원천 분류 (#1473). 화면의 카페 칩 · 핀과 검색의 {@code sourceCategory=카페} 가 이 값 하나를 본다.
     * 픽스처의 분류 코드는 2026-10-14 실조회 체계다.
     */
    @Nested
    @DisplayName("원천 분류 — 관광정보 카페")
    class SourceCategory {

        @Test
        @DisplayName("신분류 FD05 행은 카페다 — 이름에 단서가 없어도, 구분류 소분류가 비어 있어도")
        void mapsLclsSystm2CafeToCafeCategory() {
            JsonNode item = item("""
                {"contentid":"2900001","contenttypeid":"39","title":"델문도",
                 "cat1":"A05","cat2":"A0502","cat3":"",
                 "lclsSystm1":"FD","lclsSystm2":"FD05","lclsSystm3":"FD050100"}
                """);

            ImportedPlace place = adapter().toImportedPlace(item, JEJU_AREA_CODE);

            assertThat(place.sourceCategory()).isEqualTo("카페");
            // 판정 근거인 원천 코드는 그대로 남는다 — 규칙이 틀렸을 때 되짚을 수 있어야 한다
            assertThat(place.cat3()).isNull();
            assertThat(place.lclsSystm2()).isEqualTo("FD05");
        }

        @Test
        @DisplayName("신분류가 비어 오면 구분류 소분류 A05020900 으로 대신 판정한다 — dev 0곳이지만 방어한다")
        void mapsCat3CafeToCafeCategoryWithoutLclsSystm2() {
            JsonNode item = item("""
                {"contentid":"2900002","contenttypeid":"39","title":"신분류 없는 카페",
                 "cat1":"A05","cat2":"A0502","cat3":"A05020900","lclsSystm2":""}
                """);

            assertThat(adapter().toImportedPlace(item, JEJU_AREA_CODE).sourceCategory()).isEqualTo("카페");
        }

        @Test
        @DisplayName("카페가 아닌 음식점은 원천 분류를 싣지 않는다 — 제과(FD03)도 카페로 묶지 않는다")
        void leavesNonCafeRestaurantWithoutCategory() {
            JsonNode korean = item("""
                {"contentid":"2900003","contenttypeid":"39","title":"어느 한식당",
                 "cat3":"A05020100","lclsSystm2":"FD01","lclsSystm3":"FD010100"}
                """);
            JsonNode bakery = item("""
                {"contentid":"2900004","contenttypeid":"39","title":"어느 빵집",
                 "lclsSystm2":"FD03","lclsSystm3":"FD030100"}
                """);

            assertThat(adapter().toImportedPlace(korean, JEJU_AREA_CODE).sourceCategory()).isNull();
            assertThat(adapter().toImportedPlace(bakery, JEJU_AREA_CODE).sourceCategory()).isNull();
        }

        @Test
        @DisplayName("구분류는 카페여도 신분류가 제과면 카페가 아니다 — 베이커리 카페가 신분류에서 제과로 옮겨졌다(dev 6곳)")
        void lclsSystm2WinsOverCat3ForBakeryCafe() {
            // dev 2026-10-14: 베카신 · 봉주르마담 · 블루메베이글 · 수와래베이커리 · 시스터필드 · 아베베베이커리가 이 모양이다
            JsonNode item = item("""
                {"contentid":"2900006","contenttypeid":"39","title":"아베베베이커리",
                 "cat3":"A05020900","lclsSystm2":"FD03","lclsSystm3":"FD030100"}
                """);

            assertThat(adapter().toImportedPlace(item, JEJU_AREA_CODE).sourceCategory()).isNull();
        }

        @Test
        @DisplayName("분류 코드가 없는 행(음식점 외 유형 포함)은 null 이다")
        void leavesItemWithoutClassCodesNull() {
            JsonNode item = item("""
                {"contentid":"2900005","contenttypeid":"12","title":"어느 관광지"}
                """);

            assertThat(adapter().toImportedPlace(item, JEJU_AREA_CODE).sourceCategory()).isNull();
        }
    }
}
