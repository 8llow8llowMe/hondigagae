package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 기상특보 현황 문구 해석 검증.
 *
 * <p>픽스처는 <b>2026-09-01 실제 응답</b>이다({@code getPwnStatus}, stnId=184).
 * 응답이 전국 문구라는 점과 제주가 지역 목록 안에 들어 있다는 점이 이 테스트의 전제다.
 *
 * <p>지키려는 것 둘이다.
 * <ul>
 *   <li><b>남의 지역 특보를 제주 것으로 읽지 않는가</b> — stnId 가 필터하지 않으므로
 *       이 필터가 유일한 방어선이다</li>
 *   <li><b>해제된 특보를 발효 중으로 읽지 않는가</b> — 현황(t6)에는 살아 있는 것만 온다는
 *       전제가 깨지면 여기서 드러나야 한다</li>
 * </ul>
 */
class WeatherWarningStatusTextTest {

    private static final Path FIXTURE = Path.of("src/test/resources/fixtures/kma_pwn_status.json");
    private static final LocalDateTime EFFECTIVE_AT = LocalDateTime.of(2026, 9, 1, 23, 0);

    @Test
    @DisplayName("실제 응답에서 제주에 발효 중인 특보만 뽑는다")
    void parsesJejuWarningsFromRealResponse() throws IOException {
        List<WeatherWarning> warnings = WeatherWarningStatusText.parseJejuWarnings(activeText(), EFFECTIVE_AT);

        // 2026-09-01 23시 기준 제주는 폭염주의보 + 열대야주의보였다.
        assertThat(warnings).extracting(WeatherWarning::type)
            .containsExactly(WeatherWarningType.HEAT_WAVE, WeatherWarningType.TROPICAL_NIGHT);
        assertThat(warnings).allSatisfy(warning -> {
            assertThat(warning.level()).isEqualTo(WeatherWarningLevel.ADVISORY);
            assertThat(warning.effectiveAt()).isEqualTo(EFFECTIVE_AT);
        });
    }

    @Test
    @DisplayName("같은 응답에서 가장 무거운 것은 폭염주의보다")
    void picksHeaviestFromRealResponse() throws IOException {
        // 둘 다 주의보라 종류 선언 순서로 갈린다 - 폭염이 열대야보다 앞이다.
        assertThat(WeatherWarning.heaviest(
            WeatherWarningStatusText.parseJejuWarnings(activeText(), EFFECTIVE_AT)))
            .get().extracting(WeatherWarning::type).isEqualTo(WeatherWarningType.HEAT_WAVE);
    }

    @Test
    @DisplayName("제주가 없는 특보는 버린다 — stnId 가 필터해 주지 않는다")
    void dropsWarningsWithoutJeju() {
        String text = """
            o 폭염주의보 : 전라남도(영광낙월면 제외), 광주, 대구
            o 호우경보 : 경상북도(구미, 영천), 부산
            """;

        assertThat(WeatherWarningStatusText.parseJejuWarnings(text, EFFECTIVE_AT)).isEmpty();
    }

    @Test
    @DisplayName("서귀포만 적혀 있어도 제주로 본다")
    void acceptsSeogwipoOnly() {
        String text = "o 강풍주의보 : 제주도(서귀포시남부, 서귀포시동부)";

        assertThat(WeatherWarningStatusText.parseJejuWarnings(text, EFFECTIVE_AT))
            .singleElement().extracting(WeatherWarning::type)
            .isEqualTo(WeatherWarningType.STRONG_WIND);
    }

    @Test
    @DisplayName("특보가 없으면 빈 목록이다")
    void emptyWhenNone() {
        assertThat(WeatherWarningStatusText.parseJejuWarnings("o 없음\r\n\r\n", EFFECTIVE_AT)).isEmpty();
        assertThat(WeatherWarningStatusText.parseJejuWarnings("", EFFECTIVE_AT)).isEmpty();
        assertThat(WeatherWarningStatusText.parseJejuWarnings(null, EFFECTIVE_AT)).isEmpty();
    }

    @Test
    @DisplayName("지역 목록이 없는 줄은 제주 것으로 단정하지 않는다")
    void skipsLinesWithoutRegions() {
        // 어느 지역인지 모르는 것을 제주로 읽으면, 전국 어딘가의 태풍경보로 제주 일정을 막는다.
        assertThat(WeatherWarningStatusText.parseJejuWarnings("o 태풍경보", EFFECTIVE_AT)).isEmpty();
    }

    @Test
    @DisplayName("경보와 주의보를 구분한다")
    void distinguishesWarningFromAdvisory() {
        String text = """
            o 태풍경보 : 제주도(제주시서부)
            o 강풍주의보 : 제주도(제주시북부)
            """;

        assertThat(WeatherWarningStatusText.parseJejuWarnings(text, EFFECTIVE_AT))
            .extracting(WeatherWarning::level)
            .containsExactly(WeatherWarningLevel.WARNING, WeatherWarningLevel.ADVISORY);
    }

    /** 픽스처의 {@code t6}(발효 중 특보) 원문. */
    private String activeText() throws IOException {
        JsonNode root = new ObjectMapper().readTree(Files.readString(FIXTURE));
        return root.path("response").path("body").path("items").path("item").get(0).path("t6").asText();
    }
}
