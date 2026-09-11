package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * detailIntro2 타입별 필드 매핑과 원문 정규화 검증.
 *
 * <p>이 API 에서 가장 틀리기 쉬운 곳이 <b>타입마다 다른 필드 접미</b>와 <b>HTML 이 섞인 원문</b>이다.
 * 어댑터(WebClient)를 태우지 않고 {@code JsonNode} 로 직접 검증한다.
 */
class TourApiIntroFieldMapperTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("관광지(12)는 접미 없는 필드명에서 값을 옮긴다")
    void mapsTouristSpotFields() throws JsonProcessingException {
        JsonNode item = node("""
            {
              "contentid": "126508",
              "infocenter": "064-123-4567",
              "usetime": "09:00~18:00",
              "restdate": "매주 화요일",
              "parking": "주차 가능(무료)",
              "chkpet": "가능(소형견)",
              "chkbabycarriage": "가능",
              "chkcreditcard": "가능"
            }
            """);

        ImportedPlaceIntro intro = TourApiIntroFieldMapper.toImportedPlaceIntro(PlaceContentType.TOURIST_SPOT, item);

        assertThat(intro.infoCenter()).isEqualTo("064-123-4567");
        assertThat(intro.useTime()).isEqualTo("09:00~18:00");
        assertThat(intro.restDate()).isEqualTo("매주 화요일");
        assertThat(intro.parking()).isEqualTo("주차 가능(무료)");
        assertThat(intro.chkPet()).isEqualTo("가능(소형견)");
        assertThat(intro.chkBabyCarriage()).isEqualTo("가능");
        assertThat(intro.chkCreditCard()).isEqualTo("가능");
        // 요일부 없는 시각 범위는 전 요일이다
        assertThat(intro.weeklyHoursSpec()).isEqualTo("1234567:0900-1800");
        assertThat(intro.open24()).isFalse();
        assertThat(intro.rawJson()).contains("\"contentid\":\"126508\"");
    }

    @Test
    @DisplayName("음식점(39)은 opentimefood/restdatefood 에서 값을 옮기고, 없는 chkpet 은 null 로 둔다")
    void mapsRestaurantFieldsWithFoodSuffix() throws JsonProcessingException {
        JsonNode item = node("""
            {
              "infocenterfood": "064-987-6543",
              "opentimefood": "11:00~21:00",
              "restdatefood": "연중무휴",
              "parkingfood": "가능",
              "chkcreditcardfood": "가능",
              "usetime": "이 값은 관광지 필드라 음식점에서 읽지 않는다"
            }
            """);

        ImportedPlaceIntro intro = TourApiIntroFieldMapper.toImportedPlaceIntro(PlaceContentType.RESTAURANT, item);

        assertThat(intro.infoCenter()).isEqualTo("064-987-6543");
        assertThat(intro.useTime()).isEqualTo("11:00~21:00");
        assertThat(intro.restDate()).isEqualTo("연중무휴");
        assertThat(intro.parking()).isEqualTo("가능");
        assertThat(intro.chkCreditCard()).isEqualTo("가능");
        // 음식점 detailIntro2 에는 이 두 필드가 없다
        assertThat(intro.chkPet()).isNull();
        assertThat(intro.chkBabyCarriage()).isNull();
        assertThat(intro.weeklyHoursSpec()).isEqualTo("1234567:1100-2100");
        // "연중무휴"는 24시간이 아니다
        assertThat(intro.open24()).isFalse();
    }

    @Test
    @DisplayName("<br> 은 콤마가 되어 앞 구간의 스케줄이 살아남고, 남은 태그와 엔티티는 정리된다")
    void normalizesHtmlInSourceText() throws JsonProcessingException {
        JsonNode item = node("""
            {
              "usetime": "09:00~18:00<BR/>입장마감 17:30",
              "parking": "<p>주차 가능(무료)&nbsp;&amp;&nbsp;대형버스 가능</p>"
            }
            """);

        ImportedPlaceIntro intro = TourApiIntroFieldMapper.toImportedPlaceIntro(PlaceContentType.TOURIST_SPOT, item);

        assertThat(intro.useTime()).isEqualTo("09:00~18:00, 입장마감 17:30");
        assertThat(intro.weeklyHoursSpec()).isEqualTo("1234567:0900-1800");
        assertThat(intro.parking()).isEqualTo("주차 가능(무료) & 대형버스 가능");
    }

    @Test
    @DisplayName("원천의 정보없음과 빈 값은 null 로 접는다 — 모름을 문자열로 저장하지 않는다")
    void foldsUnknownMarksToNull() throws JsonProcessingException {
        JsonNode item = node("""
            {
              "usetime": "정보없음",
              "restdate": "",
              "parking": "<br>"
            }
            """);

        ImportedPlaceIntro intro = TourApiIntroFieldMapper.toImportedPlaceIntro(PlaceContentType.TOURIST_SPOT, item);

        assertThat(intro.useTime()).isNull();
        assertThat(intro.restDate()).isNull();
        assertThat(intro.parking()).isNull();
        assertThat(intro.weeklyHoursSpec()).isNull();
        assertThat(intro.open24()).isFalse();
    }

    @Test
    @DisplayName("긴 원문도 매퍼는 자르지 않는다 — 컬럼에 맞추는 일은 INSERT 를 가진 어댑터 몫이다")
    void keepsFullTextAndLeavesTruncationToPersistence() {
        String longUseTime = "09:00~18:00, " + "안내문".repeat(200);
        JsonNode item = objectMapper.createObjectNode().put("usetime", longUseTime);

        ImportedPlaceIntro intro = TourApiIntroFieldMapper.toImportedPlaceIntro(PlaceContentType.TOURIST_SPOT, item);

        assertThat(intro.useTime()).hasSize(longUseTime.length());
        // 전문으로 해석하므로 뒤에 안내문이 붙어도 앞 구간 스케줄은 살아남는다
        assertThat(intro.weeklyHoursSpec()).isEqualTo("1234567:0900-1800");
    }

    @Test
    @DisplayName("운영시간 수집 대상 타입은 전부 필드명 매핑을 갖는다 — 한쪽만 늘리면 조용히 빈 intro 가 된다")
    void everyHoursTargetTypeHasFieldNames() {
        // 매퍼의 표와 독립적으로 한 번 더 적는다. INTRO_HOURS_TARGETS 에 타입을 더하고
        // 매퍼를 빠뜨리면 여기서 먼저 걸린다.
        Map<PlaceContentType, String> useTimeFieldNames = Map.of(
            PlaceContentType.TOURIST_SPOT, "usetime",
            PlaceContentType.CULTURE, "usetimeculture",
            PlaceContentType.LEPORTS, "usetimeleports",
            PlaceContentType.SHOPPING, "opentime",
            PlaceContentType.RESTAURANT, "opentimefood"
        );

        for (PlaceContentType contentType : PlaceContentType.INTRO_HOURS_TARGETS) {
            String fieldName = useTimeFieldNames.get(contentType);
            assertThat(fieldName)
                .as("%s 의 detailIntro2 운영시간 필드명을 이 테스트에도 적어라", contentType)
                .isNotNull();

            JsonNode item = objectMapper.createObjectNode().put(fieldName, "09:00~18:00");
            assertThat(TourApiIntroFieldMapper.toImportedPlaceIntro(contentType, item).useTime())
                .as("%s 의 운영시간이 매핑되지 않았다", contentType)
                .isEqualTo("09:00~18:00");
        }
    }

    @Test
    @DisplayName("00:00~24:00 은 24시간 영업이고 전 요일 스케줄이 된다")
    void detectsAllDayOperation() throws JsonProcessingException {
        JsonNode item = node("{\"usetime\": \"00:00~24:00\"}");

        ImportedPlaceIntro intro = TourApiIntroFieldMapper.toImportedPlaceIntro(PlaceContentType.TOURIST_SPOT, item);

        assertThat(intro.open24()).isTrue();
        assertThat(intro.weeklyHoursSpec()).isEqualTo("1234567:0000-2400");
    }

    @Test
    @DisplayName("운영시간 필드가 없는 타입(숙박)은 전부 null 인 intro 로 접는다 — 터지지 않는다")
    void typesWithoutOperatingHoursFieldsFoldToEmptyIntro() throws JsonProcessingException {
        JsonNode item = node("{\"checkintime\": \"15:00\"}");

        ImportedPlaceIntro intro = TourApiIntroFieldMapper.toImportedPlaceIntro(PlaceContentType.LODGING, item);

        assertThat(intro.useTime()).isNull();
        assertThat(intro.weeklyHoursSpec()).isNull();
        assertThat(intro.open24()).isFalse();
        assertThat(intro.rawJson()).contains("checkintime");
    }

    private JsonNode node(String json) throws JsonProcessingException {
        return objectMapper.readTree(json);
    }
}
