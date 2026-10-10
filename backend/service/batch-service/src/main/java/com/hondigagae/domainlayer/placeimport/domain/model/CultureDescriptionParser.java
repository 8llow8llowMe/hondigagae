package com.hondigagae.domainlayer.placeimport.domain.model;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 문화정보원 CSV 의 {@code 기본 정보_장소설명} 을 장소 개요로 바꾼다 (#1216).
 *
 * <p>이 열은 설명문이 아니라 <b>"유형 표기[, 이용 메모…]"</b> 다. 2026-10 원본(70,650행)에서 여행 장소로 쓰는
 * 6개 분류(여행지 · 펜션 · 카페 · 박물관 · 미술관 · 문예회관) 3,580행을 세었더니 첫 토막이 유형 표기가 아닌
 * 행은 열 몇 건(카페의 {@code 상주견 있음} · {@code 예약제} · {@code 노키즈존} 등)뿐이었다. 제주 여행지
 * 64행 중 59행은 표기 하나뿐이다 — 용두암 · 수월봉 {@code 관광지}, 서귀포해양도립공원 {@code 공원}.
 *
 * <p>그 표기를 개요로 실으면 장소 상세에 "관광지" 한 낱말이 뜨고, 병합이 관광 API 장소의 빈 개요까지
 * 그 낱말로 채운다 — AI 일정 메모가 근거 없이 이름에서 짐작하던 것(#1172)이 여기서 시작됐다. 유형은
 * {@code source_category} 와 콘텐츠 유형이 이미 말하므로 <b>첫 토막이 유형 표기면 버리고</b> 뒤의 이용 메모
 * ({@code 악천후 시 휴장}, {@code 애견수영장, 사전문의 필수})만 남긴다.
 */
public final class CultureDescriptionParser {

    /**
     * 토막 경계. 숫자 사이 쉼표에서는 자르지 않는다 — {@code 추가인원 15,000원} 같은 금액이 원본에
     * 27건 있다.
     */
    private static final Pattern SEPARATOR = Pattern.compile("\\s*,(?!\\d)\\s*");

    /**
     * 유형 표기. 원본에서 센 첫 토막 그대로다 — {@code 애견카페} · {@code 고양이 카페} · {@code 애견 동반 펜션} …
     * {@code 동물원} · {@code 강아지} 처럼 유형인지 메모인지 모호한 것은 넣지 않았다. 버리면 사실을 잃는다.
     */
    private static final Pattern TYPE_LABEL = Pattern.compile(".*(카페|펜션)|관광지|공원|박물관|미술관|문예회관|체육시설");

    private CultureDescriptionParser() {
    }

    /** 유형 표기를 뺀 이용 메모. 남는 것이 없으면 null 이다 — 개요가 없는 것이지 빈 개요가 아니다. */
    public static String overviewOf(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        List<String> parts = Arrays.stream(SEPARATOR.split(description.strip()))
            .filter(part -> !part.isBlank())
            .toList();
        if (parts.isEmpty()) {
            return null;
        }
        List<String> memo = TYPE_LABEL.matcher(parts.get(0)).matches() ? parts.subList(1, parts.size()) : parts;
        return memo.isEmpty() ? null : memo.stream().collect(Collectors.joining(", "));
    }
}
