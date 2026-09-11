package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import com.hondigagae.domainlayer.placeimport.domain.model.OperatingHoursParser;
import com.hondigagae.shared.travel.schedule.WeeklySchedule;
import java.util.EnumMap;
import java.util.Map;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;

/**
 * detailIntro2 응답 한 건을 {@link ImportedPlaceIntro} 로 옮긴다.
 *
 * <p>{@code TourApiPlaceCatalogAdapter} 안이 아니라 별도 클래스인 이유는 <b>테스트 가능성</b>이다.
 * 어댑터는 WebClient·서킷·프로퍼티를 물고 있어 단위 테스트가 어렵지만, 타입별 필드 매핑과 원문
 * 정규화는 이 API 에서 가장 틀리기 쉬운 부분이다 — {@code JsonNode} 하나로 직접 검증한다.
 *
 * <p><b>detailIntro2 는 contentTypeId 마다 필드명이 다르다.</b> 같은 "운영시간"이 관광지는
 * {@code usetime}, 문화시설은 {@code usetimeculture}, 음식점은 {@code opentimefood} 다
 * (docs/data-api-analysis.md §detailIntro2). 그래서 이름표를 한곳에 모아 둔다.
 */
@Slf4j
public final class TourApiIntroFieldMapper {

    /**
     * {@code <br>} 을 콤마로 바꾼다. {@link OperatingHoursParser} 가 콤마로 세그먼트를 나누므로,
     * 이래야 {@code "09:00~18:00<br>입장마감 17:30"} 에서 앞 구간이 살아난다.
     */
    private static final Pattern LINE_BREAK_TAG = Pattern.compile("(?i)<\\s*br\\s*/?\\s*>");
    private static final Pattern ANY_TAG = Pattern.compile("<[^>]+>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    /**
     * 태그만 있던 값({@code "<br>"})이 남긴 콤마를 털어낸다 — 이게 없으면 내용이 없는 필드가
     * {@code ","} 라는 값으로 저장된다.
     */
    private static final Pattern EDGE_SEPARATORS = Pattern.compile("^[\\s,]+|[\\s,]+$");

    private record IntroFieldNames(
        String useTime,
        String restDate,
        String parking,
        String infoCenter,
        String chkPet,
        String chkBabyCarriage,
        String chkCreditCard
    ) {

    }

    private static final Map<PlaceContentType, IntroFieldNames> FIELD_NAMES = fieldNames();

    private TourApiIntroFieldMapper() {
    }

    private static Map<PlaceContentType, IntroFieldNames> fieldNames() {
        Map<PlaceContentType, IntroFieldNames> names = new EnumMap<>(PlaceContentType.class);
        names.put(PlaceContentType.TOURIST_SPOT, new IntroFieldNames(
            "usetime", "restdate", "parking", "infocenter", "chkpet", "chkbabycarriage", "chkcreditcard"));
        names.put(PlaceContentType.CULTURE, new IntroFieldNames(
            "usetimeculture", "restdateculture", "parkingculture", "infocenterculture",
            "chkpetculture", "chkbabycarriageculture", "chkcreditcardculture"));
        names.put(PlaceContentType.LEPORTS, new IntroFieldNames(
            "usetimeleports", "restdateleports", "parkingleports", "infocenterleports",
            "chkpetleports", "chkbabycarriageleports", "chkcreditcardleports"));
        names.put(PlaceContentType.SHOPPING, new IntroFieldNames(
            "opentime", "restdateshopping", "parkingshopping", "infocentershopping",
            "chkpetshopping", "chkbabycarriageshopping", "chkcreditcardshopping"));
        // 음식점에는 chkpet / chkbabycarriage 가 없다 — null 로 둔다.
        names.put(PlaceContentType.RESTAURANT, new IntroFieldNames(
            "opentimefood", "restdatefood", "parkingfood", "infocenterfood",
            null, null, "chkcreditcardfood"));
        return Map.copyOf(names);
    }

    /**
     * 원문 한 건을 옮긴다.
     *
     * <p>표에 없는 타입(숙박·여행코스·축제)은 detailIntro2 에 운영시간 필드가 없다. 대상 선정에서
     * 이미 걸러지지만, 들어와도 전부 null 인 intro 로 취급해 터지지 않게 둔다.
     */
    public static ImportedPlaceIntro toImportedPlaceIntro(PlaceContentType contentType, JsonNode item) {
        IntroFieldNames names = FIELD_NAMES.get(contentType);
        if (names == null) {
            log.debug("detailIntro2 has no operating-hours fields. contentType={}", contentType);
            return ImportedPlaceIntro.builder().rawJson(rawJson(item)).build();
        }

        // 값은 원문 전문 그대로 옮긴다. 컬럼 길이에 맞추는 일은 INSERT 문을 가진
        // JdbcPlaceIntroBulkAdapter 가 한다 — 스키마를 아는 쪽이 거기이기 때문이다.
        String useTime = normalize(text(item, names.useTime()));
        // 요일 표기 없는 시각 범위를 매일로 보는 변이를 쓴다. 이 값은 장소 상세에 "모름" 갈래가
        // 있는 표시용이고, 긴급 시설의 하드 필터(openNowOnly)와 소비처가 다르다.
        WeeklySchedule schedule = OperatingHoursParser.parseWeeklyAssumingEveryDay(useTime);

        return ImportedPlaceIntro.builder()
            .infoCenter(normalize(text(item, names.infoCenter())))
            .useTime(useTime)
            .weeklyHoursSpec(schedule == null ? null : schedule.toSpec())
            // 상호는 detailIntro2 응답에 없다 — 이름 신호(24시)는 여기서 판정할 수 없어 null 을 넘긴다.
            .open24(OperatingHoursParser.isOpen24(null, useTime))
            .restDate(normalize(text(item, names.restDate())))
            .parking(normalize(text(item, names.parking())))
            .chkPet(normalize(text(item, names.chkPet())))
            .chkBabyCarriage(normalize(text(item, names.chkBabyCarriage())))
            .chkCreditCard(normalize(text(item, names.chkCreditCard())))
            .rawJson(rawJson(item))
            .build();
    }

    /**
     * raw_json 은 MySQL JSON 컬럼이라 유효한 JSON 이어야 한다. Jackson 이 만든 노드의
     * {@code toString()} 은 그 자체로 유효한 JSON 이므로 수제 이스케이프가 필요 없다.
     */
    private static String rawJson(JsonNode item) {
        if (item == null || item.isMissingNode() || item.isNull()) {
            return null;
        }
        return item.toString();
    }

    /**
     * 원천 상세 텍스트에는 HTML 이 섞여 온다. 태그를 지우고 엔티티를 문자로 되돌린 뒤 공백을
     * 하나로 접는다. 마지막에 {@code normalizeHours} 를 통과시켜 원천의 "정보없음"을 null 로 만든다.
     */
    private static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String text = LINE_BREAK_TAG.matcher(raw).replaceAll(", ");
        text = ANY_TAG.matcher(text).replaceAll("");
        text = unescapeEntities(text);
        text = WHITESPACE.matcher(text).replaceAll(" ");
        text = EDGE_SEPARATORS.matcher(text).replaceAll("");
        return OperatingHoursParser.normalizeHours(text);
    }

    /** {@code &amp;} 를 마지막에 푸는 이유 — 먼저 풀면 {@code &amp;lt;} 가 이중 복원된다. */
    private static String unescapeEntities(String text) {
        return text
            .replace("&nbsp;", " ")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&amp;", "&");
    }

    private static String text(JsonNode node, String field) {
        if (field == null) {
            return null;
        }
        String value = node.path(field).asText("");
        return value.isBlank() ? null : value;
    }
}
