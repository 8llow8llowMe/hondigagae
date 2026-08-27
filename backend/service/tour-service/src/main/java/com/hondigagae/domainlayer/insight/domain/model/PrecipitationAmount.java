package com.hondigagae.domainlayer.insight.domain.model;

/**
 * 기상청 PCP(1시간 강수량) / SNO(신적설) 값.
 *
 * <p><b>이 원천은 숫자가 아니다.</b> TMP 같은 항목은 "24.0" 이 오지만 PCP 는
 * "강수없음", "1mm 미만", "30.0~50.0mm", "50.0mm 이상" 같은 사람이 읽는 문자열이
 * 섞여 온다. 그대로 Double.parseDouble 하면 터진다.
 *
 * <p>그래서 두 값을 함께 들고 있는다.
 * <ul>
 *   <li>millimeters — 비교/점수 계산에 쓰는 수치. 범위 표기는 <b>하한</b>을 취한다</li>
 *   <li>text — 화면에 그대로 보여줄 원문. 범위 표기를 숫자로 뭉개면 정보가 사라진다</li>
 * </ul>
 * 하한을 취하는 이유는 "30.0~50.0mm" 를 30 으로 보아도 위험을 과소평가하지 않기 때문이다.
 * 판정 기준이 그보다 훨씬 낮은 곳에 있다.
 */
public record PrecipitationAmount(double millimeters, String text) {

    private static final String NO_PRECIPITATION_TEXT = "강수없음";
    /** SNO(신적설)는 같은 뜻을 다른 말로 준다. 실측에서 확인했다. */
    private static final String NO_SNOWFALL_TEXT = "적설없음";
    private static final PrecipitationAmount NONE = new PrecipitationAmount(0d, NO_PRECIPITATION_TEXT);
    /** "1mm 미만" 처럼 하한이 없는 표기에 쓰는 대표값. 0 으로 두면 "비가 안 온다"가 되어 버린다. */
    private static final double TRACE_MILLIMETERS = 0.5d;

    public static PrecipitationAmount none() {
        return NONE;
    }

    /**
     * 원천 문자열을 해석한다. 해석할 수 없으면 강수없음으로 보되 원문은 남긴다.
     */
    public static PrecipitationAmount parse(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return NONE;
        }
        String value = rawValue.trim();
        if (value.contains(NO_PRECIPITATION_TEXT) || value.contains(NO_SNOWFALL_TEXT)
            || "-".equals(value) || "0".equals(value)) {
            return NONE;
        }
        if (value.contains("미만")) {
            return new PrecipitationAmount(TRACE_MILLIMETERS, value);
        }

        // "30.0~50.0mm" 는 하한을, "50.0mm 이상" 과 "1.0mm" 는 표기된 수를 취한다.
        int rangeIndex = value.indexOf('~');
        String head = rangeIndex > 0 ? value.substring(0, rangeIndex) : value;
        Double parsed = firstNumber(head);
        if (parsed == null) {
            return new PrecipitationAmount(0d, value);
        }
        return new PrecipitationAmount(parsed, value);
    }

    private static Double firstNumber(String value) {
        StringBuilder digits = new StringBuilder();
        for (char character : value.toCharArray()) {
            if (Character.isDigit(character) || character == '.') {
                digits.append(character);
            } else if (digits.length() > 0) {
                break;
            }
        }
        if (digits.length() == 0) {
            return null;
        }
        try {
            return Double.valueOf(digits.toString());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    public boolean hasPrecipitation() {
        return millimeters > 0d;
    }
}
