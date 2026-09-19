package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 올레코스현황 CSV 와 TourAPI 제목의 파싱 규칙. <b>매칭 키를 만드는 규칙이 한 곳에 있어야</b>
 * 두 원천이 같은 코스를 다른 키로 부르는 일이 없다.
 *
 * <ul>
 *   <li>CSV "코스별" = {@code 3코스} → 코스번호 {@code 3}, "코스명" 꼬리 {@code (A)} → 변형</li>
 *   <li>TourAPI title = {@code [제주올레 3-A코스] 온평-표선 올레} → 같은 키 {@code 3-A}</li>
 * </ul>
 */
public final class OlleCourseParser {

    /** 해시 기반 id 하한. place 의 TourAPI contentId 대역과 겹치지 않는 규칙(PlaceIdFactory)을 그대로 따른다. */
    private static final long HASH_ID_BASE = 1L << 62;
    private static final long HASH_ID_RANGE = 1L << 61;

    private static final Pattern COURSE_NO_PATTERN = Pattern.compile("^([0-9]+(?:-[0-9]+)?)코스$");
    private static final Pattern VARIANT_PATTERN = Pattern.compile("\\(([A-Za-z])\\)\\s*$");
    /**
     * TourAPI title 의 머리 부분. group(1)=코스번호, group(2)=대괄호 안 변형 문자(없을 수 있다).
     *
     * <p>변형 문자 자리를 <b>숫자 부번호 다음</b>에 둬야 {@code 18-2} 가 "18 + 변형 2" 로 잘못 읽히지
     * 않는다 - {@code [0-9]+(?:-[0-9]+)?} 가 먼저 숫자 부번호를 다 가져가고, 남은 {@code -A} 만
     * 변형으로 떨어진다.
     */
    private static final Pattern TOUR_TITLE_PATTERN =
        Pattern.compile("^\\[제주올레\\s*([0-9]+(?:-[0-9]+)?)(?:-([A-Za-z]))?코스\\]");
    private static final Pattern DISTANCE_PATTERN = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)\\s*km");
    private static final Pattern DURATION_HOUR_PATTERN = Pattern.compile("([0-9]+)\\s*시간");

    private OlleCourseParser() {
    }

    /** CSV "코스별"(1코스, 1-1코스)에서 코스번호를 뽑는다. 형식이 다르면 그 행이 원천 규격을 벗어난 것이다. */
    public static String courseNo(String rawCourseNo) {
        Matcher matcher = COURSE_NO_PATTERN.matcher(rawCourseNo == null ? "" : rawCourseNo.trim());
        if (!matcher.matches()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_ROW_INVALID, rawCourseNo);
        }
        return matcher.group(1);
    }

    /** 코스명 꼬리의 변형 구분. "온평-표선(A)" → "A". 없으면 null 이다. */
    public static String variantOf(String courseName) {
        if (courseName == null) {
            return null;
        }
        Matcher matcher = VARIANT_PATTERN.matcher(courseName.trim());
        return matcher.find() ? matcher.group(1).toUpperCase() : null;
    }

    /** 두 원천이 같은 코스를 부르는 키. 변형이 있으면 "3-A", 없으면 "1-1" 이다. */
    public static String courseKey(String courseNo, String variant) {
        return variant == null || variant.isBlank() ? courseNo : courseNo + "-" + variant;
    }

    /** 정렬 순서. 본번호*10 + 부번호 - "1"→10, "1-1"→11, "18-2"→182 로 코스번호 순이 유지된다. */
    public static int courseOrder(String courseNo) {
        String[] parts = courseNo.split("-");
        int main = Integer.parseInt(parts[0]);
        int sub = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
        return main * 10 + sub;
    }

    /** "15.1km" → 15.1. 숫자를 못 찾으면 그 행이 원천 규격을 벗어난 것이다. */
    public static BigDecimal distanceKm(String rawDistance) {
        Matcher matcher = DISTANCE_PATTERN.matcher(rawDistance == null ? "" : rawDistance.trim());
        if (!matcher.find()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_ROW_INVALID, rawDistance);
        }
        return new BigDecimal(matcher.group(1));
    }

    /**
     * "4~5시간" → 300(분). 활동량 상한 비교에 쓰는 값이라 <b>큰 쪽</b>을 잡는다 - 작은 쪽으로
     * 잡으면 "장시간 활동을 힘들어하는" 아이에게 상한 근처 코스가 통과된다. 시간 표기를 못
     * 찾으면 null 로 남긴다 - 원문(durationText)은 따로 보존된다.
     */
    public static Integer durationMaxMinutes(String rawDuration) {
        if (rawDuration == null) {
            return null;
        }
        Matcher matcher = DURATION_HOUR_PATTERN.matcher(rawDuration);
        Integer maxHours = null;
        while (matcher.find()) {
            int hours = Integer.parseInt(matcher.group(1));
            maxHours = maxHours == null ? hours : Math.max(maxHours, hours);
        }
        return maxHours == null ? null : maxHours * 60;
    }

    /**
     * TourAPI title 에서 매칭 키를 뽑는다. 제주올레 표기가 아니면(하영올레 등) null 이다 -
     * 다른 길을 올레 코스로 붙이면 안 된다.
     *
     * <p><b>변형(A/B) 표기가 두 형식이라 둘 다 받는다.</b> 원천이 2026-09 무렵 변형 문자를
     * 괄호 접미사에서 대괄호 안으로 옮겼는데, 되돌리거나 섞어 줄 수 있다. 한쪽만 받으면 그날
     * 해당 코스의 좌표가 오류 없이 조용히 빠진다.
     *
     * <ul>
     *   <li>새 형식 - {@code [제주올레 3-A코스] 온평-표선 올레} → {@code 3-A}</li>
     *   <li>옛 형식 - {@code [제주올레 3코스] 온평-표선 올레 (A)} → {@code 3-A}</li>
     * </ul>
     */
    public static String courseKeyFromTourTitle(String title) {
        if (title == null) {
            return null;
        }
        Matcher matcher = TOUR_TITLE_PATTERN.matcher(title.trim());
        if (!matcher.find()) {
            return null;
        }
        String bracketVariant = matcher.group(2);
        // 대괄호 안에 변형이 있으면 그것이 원천의 판단이다. 없을 때만 옛 형식(괄호 접미사)으로 내려간다.
        return bracketVariant != null
            ? courseKey(matcher.group(1), bracketVariant.toUpperCase())
            : courseKey(matcher.group(1), variantOf(title));
    }

    /**
     * 결정적 id. 같은 코스는 몇 번을 재실행해도 같은 id 가 나와 upsert 가 멱등해진다.
     * 대역 규칙은 {@code PlaceIdFactory} 와 같다 - 2^62 이상이라 TourAPI contentId 와 겹치지 않는다.
     */
    public static long walkCourseId(String courseKey) {
        return HASH_ID_BASE + Math.floorMod(hash("OLLE|" + courseKey), HASH_ID_RANGE);
    }

    private static long hash(String seed) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(seed.getBytes(StandardCharsets.UTF_8));
            long value = 0L;
            for (int i = 0; i < 8; i++) {
                value = (value << 8) | (digest[i] & 0xFF);
            }
            return value;
        } catch (NoSuchAlgorithmException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.ID_GENERATION_FAILED, exception);
        }
    }
}
