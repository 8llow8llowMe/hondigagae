package com.hondigagae.domainlayer.placeimport.domain.model;

import java.util.regex.Pattern;

/**
 * 운영시간 문자열 해석.
 *
 * <p>제주 동물병원 225행의 실제 값을 보고 규칙을 정했다. 운영시간이 "정보없음"인 곳이 절반(111행)이고,
 * 24시간 운영은 3곳뿐이다.
 *
 * <p><b>"연중무휴"를 24시간으로 보지 않는다.</b> 매일 문을 연다는 뜻이지 24시간이라는 뜻이 아니다 —
 * 실제로 "연중무휴"이면서 운영시간이 14:00~20:00인 병원이 있었다.
 */
public final class OperatingHoursParser {

    private static final String UNKNOWN_MARK = "정보없음";
    /** 00:00~24:00 형태만 24시간으로 인정한다. */
    private static final Pattern ALL_DAY_HOURS = Pattern.compile("0?0:00\s*~\s*24:00");
    /** 상호에 "24시"가 들어간 경우. 운영시간이 비어 있어도 이 신호는 신뢰한다. */
    private static final Pattern NAME_24H = Pattern.compile("24\s*시");

    private OperatingHoursParser() {
    }

    /** 원천이 "정보없음"으로 채워 보내는 값을 null 로 바꾼다. 화면에서 "정보 없음"으로 표시하기 위해서다. */
    public static String normalizeHours(String raw) {
        if (raw == null || raw.isBlank() || UNKNOWN_MARK.equals(raw.trim())) {
            return null;
        }
        return raw.trim();
    }

    public static boolean isOpen24(String name, String operatingHours) {
        if (name != null && NAME_24H.matcher(name).find()) {
            return true;
        }
        return operatingHours != null && ALL_DAY_HOURS.matcher(operatingHours).find();
    }
}
