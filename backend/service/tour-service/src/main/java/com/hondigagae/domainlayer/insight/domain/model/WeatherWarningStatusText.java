package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 기상특보 현황 문구({@code getPwnStatus} 의 {@code t6}) 해석.
 *
 * <p>2026-09-01 실호출로 확인한 형태다.
 *
 * <pre>
 * o 폭염주의보 : 전라남도(영광낙월면 제외), ..., 제주도(제주시서부, 서귀포시남부, ...), 광주, 대구
 * o 열대야주의보 : 전라남도(보성, 여수, ...), 제주도(제주시서부, ...), 광주
 * </pre>
 *
 * <h2>지역을 여기서 걸러야 한다</h2>
 *
 * <b>{@code stnId} 파라미터는 응답을 필터하지 않는다.</b> 실호출에서 제주(184)와 서울(108)에
 * 같은 전국 문구가 왔다. 그래서 특보 종류마다 붙은 지역 목록에 제주가 있는지를 직접 본다 -
 * 이 과정을 빠뜨리면 <b>전라남도 폭염주의보를 제주 특보로 읽는다.</b>
 *
 * <h2>발효 중인 것만 온다</h2>
 *
 * 이 문구가 {@code getWthrWrnList}(통보문 이력)와 다른 점이다. 그쪽은 "호우주의보 해제"처럼
 * <b>해제 통보문까지 한 행으로</b> 오기 때문에, 그것을 발효 중으로 읽으면 이미 풀린 경보로
 * 사용자의 일정을 취소시키게 된다. 현황({@code t6})에는 지금 살아 있는 것만 남는다.
 *
 * <p>특보가 하나도 없으면 {@code "o 없음"} 한 줄이다.
 */
public final class WeatherWarningStatusText {

    private static final String LINE_PREFIX = "o ";
    private static final String NONE = "없음";
    private static final String NAME_REGION_SEPARATOR = ":";
    /** 제주를 가리키는 표기. 지역 목록은 {@code 제주도(제주시서부, 서귀포시남부, ...)} 형태다. */
    private static final List<String> JEJU_KEYWORDS = List.of("제주", "서귀포");

    private WeatherWarningStatusText() {
    }

    /**
     * 현황 문구에서 <b>제주에 발효 중인</b> 특보만 뽑는다.
     *
     * @param statusText  {@code t6} 원문
     * @param effectiveAt 발효 시각({@code tmEf}). 없으면 null
     */
    public static List<WeatherWarning> parseJejuWarnings(String statusText, LocalDateTime effectiveAt) {
        List<WeatherWarning> warnings = new ArrayList<>();
        if (statusText == null || statusText.isBlank()) {
            return warnings;
        }

        for (String rawLine : statusText.split("\\R")) {
            String line = rawLine.strip();
            if (!line.startsWith(LINE_PREFIX)) {
                continue;
            }
            String body = line.substring(LINE_PREFIX.length()).strip();
            if (body.isEmpty() || body.startsWith(NONE)) {
                continue;
            }

            int separator = body.indexOf(NAME_REGION_SEPARATOR);
            if (separator < 0) {
                // 지역 목록이 없는 줄. 어느 지역인지 알 수 없으므로 제주 것으로 단정하지 않는다.
                continue;
            }
            String name = body.substring(0, separator).strip();
            String regions = body.substring(separator + 1);
            if (name.isEmpty() || !mentionsJeju(regions)) {
                continue;
            }

            warnings.add(WeatherWarning.builder()
                .type(WeatherWarningType.from(name))
                .level(WeatherWarningLevel.from(name))
                .effectiveAt(effectiveAt)
                .sourceText(name)
                .build());
        }
        return warnings;
    }

    private static boolean mentionsJeju(String regions) {
        for (String keyword : JEJU_KEYWORDS) {
            if (regions.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
