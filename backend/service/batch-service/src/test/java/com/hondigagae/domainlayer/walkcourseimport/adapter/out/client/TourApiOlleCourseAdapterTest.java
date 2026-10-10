package com.hondigagae.domainlayer.walkcourseimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCoordinateQueryResult;
import com.hondigagae.global.properties.TourApiProperties;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * TourAPI 올레 좌표 조회의 요청 형태와 응답 매핑 (#722).
 *
 * <p>여기가 틀려도 배치는 성공으로 끝난다 - 좌표 없는 코스가 늘 뿐이라 오류로 드러나지 않는다.
 * 그래서 실호출 없이 검증할 수 있는 두 지점(요청 URI·응답 매핑)을 테스트로 고정한다.
 */
class TourApiOlleCourseAdapterTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private static TourApiOlleCourseAdapter adapter() {
        return new TourApiOlleCourseAdapter(null, OBJECT_MAPPER,
            new TourApiProperties("https://apis.data.go.kr/B551011", "test-service-key", "ETC", "hondigagae"), null);
    }

    private static JsonNode body(String itemsJson) {
        try {
            return OBJECT_MAPPER.readTree("{\"items\":{\"item\":%s}}".formatted(itemsJson));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    @Nested
    @DisplayName("요청 URI")
    class BuildUri {

        @Test
        @DisplayName("지역 조건은 법정동 시도코드(50)다 - 구 areaCode=39 로는 33건 중 3건만 잡힌다")
        void usesLegalDongRegionCode() {
            String uri = adapter().buildSearchKeywordUri().toString();

            assertThat(uri).contains("lDongRegnCd=50");
            assertThat(uri).doesNotContain("areaCode=");
        }

        @Test
        @DisplayName("arrange 를 넣지 않는다 - 정렬이 아니라 '대표이미지 있는 것만' 필터라 코스를 조용히 지운다")
        void omitsArrangeFilter() {
            assertThat(adapter().buildSearchKeywordUri().toString()).doesNotContain("arrange=");
        }

        @Test
        @DisplayName("키워드·콘텐츠타입·페이지 크기는 그대로 유지한다")
        void keepsKeywordAndPaging() {
            URI uri = adapter().buildSearchKeywordUri();

            // "올레" 는 UTF-8 퍼센트 인코딩으로 나간다 - 원문 그대로 보내면 TourAPI 가 빈 결과를 준다.
            assertThat(uri.toString()).contains("keyword=%EC%98%AC%EB%A0%88");
            assertThat(uri.toString()).contains("contentTypeId=28");
            assertThat(uri.toString()).contains("numOfRows=100");
            assertThat(uri.toString()).contains("pageNo=1");
        }
    }

    @Nested
    @DisplayName("응답 매핑")
    class MapItems {

        @Test
        @DisplayName("mapx 는 경도, mapy 는 위도다 - 뒤집으면 제주 좌표가 바다로 간다")
        void mapsMapxToLngAndMapyToLat() {
            Map<String, OlleCourseCoordinateQueryResult> coordinates = adapter().toCoordinatesByCourseKey(body("""
                [{"title":"[제주올레 6코스] 쇠소깍-제주올레 여행자센터 올레","mapx":"126.6200000000","mapy":"33.2500000000",
                  "contentid":"2650000","firstimage":"https://img/6.jpg"}]
                """));

            OlleCourseCoordinateQueryResult course6 = coordinates.get("6");
            assertThat(course6.lat()).isEqualTo(33.25);
            assertThat(course6.lng()).isEqualTo(126.62);
            assertThat(course6.contentId()).isEqualTo(2_650_000L);
            assertThat(course6.firstImage()).isEqualTo("https://img/6.jpg");
        }

        @Test
        @DisplayName("변형 제목은 변형 키로 들어가고, 올레가 아닌 항목은 들어가지 않는다")
        void keysByCourseKeyAndSkipsNonOlle() {
            Map<String, OlleCourseCoordinateQueryResult> coordinates = adapter().toCoordinatesByCourseKey(body("""
                [{"title":"[제주올레 3-A코스] 온평-표선 올레","mapx":"126.9","mapy":"33.3"},
                 {"title":"[제주올레 3-B코스] 온평-표선 올레","mapx":"126.8","mapy":"33.4"},
                 {"title":"[하영올레] 1코스","mapx":"126.5","mapy":"33.2"}]
                """));

            assertThat(coordinates).containsOnlyKeys("3-A", "3-B");
        }

        @Test
        @DisplayName("좌표가 빈 항목은 맵에 넣지 않는다 - 넣으면 프로세서가 좌표 있는 코스로 착각한다")
        void skipsItemsWithoutCoordinates() {
            Map<String, OlleCourseCoordinateQueryResult> coordinates = adapter().toCoordinatesByCourseKey(body("""
                [{"title":"[제주올레 21코스] 하도-종달 올레","mapx":"","mapy":""},
                 {"title":"[제주올레 1-1코스] 우도 올레","mapx":"126.95","mapy":"33.50"}]
                """));

            assertThat(coordinates).containsOnlyKeys("1-1");
        }

        @Test
        @DisplayName("items 가 빈 문자열이어도 터지지 않는다 - TourAPI 가 결과 0건을 그렇게 준다")
        void toleratesBlankItems() throws Exception {
            JsonNode emptyBody = OBJECT_MAPPER.readTree("{\"items\":\"\"}");

            assertThat(adapter().toCoordinatesByCourseKey(emptyBody)).isEmpty();
        }
    }
}
