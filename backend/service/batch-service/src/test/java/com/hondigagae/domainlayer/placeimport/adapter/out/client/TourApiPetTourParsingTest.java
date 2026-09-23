package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PetTourSyncQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import com.hondigagae.domainlayer.placeimport.domain.model.PetFieldParser;
import com.hondigagae.global.properties.TourApiProperties;
import java.net.URI;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 반려동물 동반여행(KorPetTourService2) 요청 조립과 응답 해석 (#877).
 *
 * <p>{@link TourApiPlaceCatalogAdapterTest} 와 같은 방식이다 — 실제 원천에 요청하지 않고 URI 조립과
 * 응답 본문 해석만 떼어 본다. 픽스처는 2026-09-23 실측 응답의 모양을 옮긴 것이다.
 */
class TourApiPetTourParsingTest {

    private static final String JEJU_AREA_CODE = "39";

    private static TourApiPlaceCatalogAdapter adapter() {
        return new TourApiPlaceCatalogAdapter(null, new ObjectMapper(),
            new TourApiProperties("https://apis.data.go.kr/B551011", "test-service-key", "ETC", "hondigagae"), null);
    }

    private static String wrap(String items, int totalCount) {
        return """
            {"response":{"header":{"resultCode":"0000","resultMsg":"OK"},
             "body":{"items":%s,"numOfRows":10,"pageNo":1,"totalCount":%d}}}
            """.formatted(items, totalCount);
    }

    @Nested
    @DisplayName("요청 조립")
    class RequestUri {

        @Test
        @DisplayName("동기화 목록은 areaCode 가 아니라 lDongRegnCd 로 묻는다 — areaCode=39 는 31건, lDongRegnCd=50 은 336건이다")
        void syncListAsksByLegalDongRegionCode() {
            URI uri = adapter().buildPetTourSyncListUri(JEJU_AREA_CODE, 1, 1000);

            assertThat(uri.toString())
                .contains("/KorPetTourService2/petTourSyncList2?")
                .contains("lDongRegnCd=50")
                .contains("pageNo=1")
                .contains("numOfRows=1000")
                .doesNotContain("areaCode=");
        }

        @Test
        @DisplayName("상세는 서비스명에 2 가 붙은 경로로 부른다 — 무접미 KorPetTourService 는 400 이다")
        void detailUsesVersionedServiceName() {
            URI uri = adapter().buildDetailPetTourUri(1887866L);

            assertThat(uri.toString())
                .contains("/KorPetTourService2/detailPetTour2?")
                .contains("contentId=1887866")
                .contains("_type=json");
        }

        @Test
        @DisplayName("매핑에 없는 지역코드는 즉시 막는다 — 지역 파라미터가 빠지면 전국 목록이 온다")
        void rejectsUnknownAreaCode() {
            assertThatThrownBy(() -> adapter().buildPetTourSyncListUri("41", 1, 1000))
                .isInstanceOf(PlaceImportException.class)
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.REGION_NOT_SUPPORTED);
        }
    }

    @Nested
    @DisplayName("동기화 목록 해석")
    class SyncList {

        @Test
        @DisplayName("showflag 0 만 내림이고, 비었거나 1 이면 노출이다 — 지우는 쪽은 원천이 말했을 때만 간다")
        void readsShowFlag() {
            PetTourSyncQueryResult result = adapter().toPetTourSyncResult(wrap("""
                {"item":[
                  {"contentid":"1887866","showflag":"1","title":"갑선이오름"},
                  {"contentid":"2925674","showflag":"0","title":"내린 곳"},
                  {"contentid":"3307027","showflag":"","title":"값 없음"},
                  {"contentid":"","showflag":"1","title":"키 없음"}
                ]}
                """, 4), 1, 1000);

            assertThat(result.entries()).containsExactly(
                new PetTourSyncQueryResult.Entry(1887866L, true),
                new PetTourSyncQueryResult.Entry(2925674L, false),
                new PetTourSyncQueryResult.Entry(3307027L, true));
            assertThat(result.totalCount()).isEqualTo(4);
            assertThat(result.hasNext()).isFalse();
        }

        @Test
        @DisplayName("한 건이면 item 이 배열이 아니라 객체로 온다")
        void readsSingleObjectItem() {
            PetTourSyncQueryResult result = adapter().toPetTourSyncResult(
                wrap("{\"item\":{\"contentid\":\"1887866\",\"showflag\":\"1\"}}", 1), 1, 1000);

            assertThat(result.entries()).containsExactly(new PetTourSyncQueryResult.Entry(1887866L, true));
        }

        @Test
        @DisplayName("0건이면 items 가 빈 문자열로 온다 — 오류가 아니라 빈 목록이다")
        void emptyStringItemsIsEmptyPage() {
            PetTourSyncQueryResult result = adapter().toPetTourSyncResult(wrap("\"\"", 0), 1, 1000);

            assertThat(result.entries()).isEmpty();
            assertThat(result.hasNext()).isFalse();
        }

        @Test
        @DisplayName("totalCount 가 페이지를 넘기면 다음 페이지가 있다")
        void hasNextWhenTotalExceedsPage() {
            PetTourSyncQueryResult result = adapter().toPetTourSyncResult(
                wrap("{\"item\":{\"contentid\":\"1\",\"showflag\":\"1\"}}", 1001), 1, 1000);

            assertThat(result.hasNext()).isTrue();
        }
    }

    @Nested
    @DisplayName("상세 해석")
    class Detail {

        @Test
        @DisplayName("동반 정보가 없으면 items=\"\" 로 온다 — 오류가 아니라 비어 있음이다 (실측 1839477)")
        void emptyStringItemsIsNoInfo() {
            Optional<ImportedPlacePetInfo> petInfo = adapter().toPlacePetInfo(wrap("\"\"", 0));

            assertThat(petInfo).isEmpty();
        }

        @Test
        @DisplayName("아이템은 왔는데 아홉 칸이 전부 비었으면 비어 있음으로 본다 — 빈 동반 정보 행을 만들지 않는다")
        void allBlankFieldsIsNoInfo() {
            Optional<ImportedPlacePetInfo> petInfo = adapter().toPlacePetInfo(wrap("""
                {"item":[{"contentid":"1","acmpyTypeCd":"","acmpyPsblCpam":"","acmpyNeedMtr":"",
                  "etcAcmpyInfo":"","relaAcdntRiskMtr":"","relaFrnshPrdlst":"","relaPosesFclty":"",
                  "relaPurcPrdlst":"","relaRntlPrdlst":""}]}
                """, 1));

            assertThat(petInfo).isEmpty();
        }

        @Test
        @DisplayName("원문은 그대로 두고 빈 문자열만 null 로 접으며, 가공 세 칸은 기존 규칙으로 채운다 (실측 가세오름)")
        void keepsSourceTextAndDerivesThreeColumns() {
            ImportedPlacePetInfo petInfo = adapter().toPlacePetInfo(wrap("""
                {"item":[{"contentid":"1887866","acmpyTypeCd":"전구역 동반가능",
                  "acmpyPsblCpam":"전 견종 동반 가능","acmpyNeedMtr":"목줄 착용",
                  "etcAcmpyInfo":"- 길이 협소한 편으로\\n- 맹견의 경우, 입마개 착용 필수",
                  "relaAcdntRiskMtr":"","relaFrnshPrdlst":"","relaPosesFclty":"",
                  "relaPurcPrdlst":"","relaRntlPrdlst":""}]}
                """, 1)).orElseThrow();

            assertThat(petInfo.acmpyTypeCd()).isEqualTo("전구역 동반가능");
            assertThat(petInfo.acmpyPsblCpam()).isEqualTo("전 견종 동반 가능");
            assertThat(petInfo.acmpyNeedMtr()).isEqualTo("목줄 착용");
            assertThat(petInfo.etcAcmpyInfo()).contains("\n").contains("입마개");
            assertThat(petInfo.relaAcdntRiskMtr()).isNull();
            assertThat(petInfo.relaRntlPrdlst()).isNull();

            assertThat(petInfo.allowanceScope()).isEqualTo(PetFieldParser.SCOPE_FULL_AREA);
            assertThat(petInfo.allowedPetSize()).isEqualTo(PetFieldParser.SIZE_ALL);
            assertThat(petInfo.leashRequired()).isTrue();
        }

        @Test
        @DisplayName("구역만 말한 곳은 크기 UNKNOWN · 목줄 false 다 — 모름을 조건으로 올리지 않는다 (실측 2925674)")
        void onlyScopeKnown() {
            ImportedPlacePetInfo petInfo = adapter().toPlacePetInfo(wrap("""
                {"item":{"contentid":"2925674","acmpyTypeCd":"전구역 동반가능","acmpyPsblCpam":"",
                  "acmpyNeedMtr":"","etcAcmpyInfo":""}}
                """, 1)).orElseThrow();

            assertThat(petInfo.allowanceScope()).isEqualTo(PetFieldParser.SCOPE_FULL_AREA);
            assertThat(petInfo.allowedPetSize()).isEqualTo(PetFieldParser.SIZE_UNKNOWN);
            assertThat(petInfo.leashRequired()).isFalse();
        }

        @Test
        @DisplayName("한도 초과 본문은 TOUR_API_QUOTA_EXCEEDED 로 옮긴다 — 호출부가 스텝을 멈춰야 한다")
        void quotaExceededBody() {
            String body = """
                {"response":{"header":{"resultCode":"22","resultMsg":"LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"}}}
                """;

            assertThatThrownBy(() -> adapter().toPlacePetInfo(body))
                .isInstanceOf(PlaceImportException.class)
                .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
                .isEqualTo(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED);
        }
    }
}
