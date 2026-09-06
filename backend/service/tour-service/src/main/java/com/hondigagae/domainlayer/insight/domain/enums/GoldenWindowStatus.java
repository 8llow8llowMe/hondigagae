package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 골든타임을 줬는지, 안 줬다면 <b>왜</b> 안 줬는지.
 *
 * <p><b>추천 구간이 없는 데에는 성질이 다른 셋이 섞여 있다.</b> 이것을 {@code goldenStart:
 * null} 하나로 뭉개면 화면은 이유를 고를 수 없고, 결국 셋 중 하나의 문구를 나머지 둘에도
 * 쓰게 된다.
 *
 * <p>실제로 그렇게 틀렸다 — 풍랑경보가 발효된 날 곡선에는 저녁 안전 구간이 초록으로 그려져
 * 있는데 화면은 "남은 시간이 모두 위험 등급이에요"라고 단정했다. 곡선과 문장이 서로 다른
 * 말을 하면 사용자는 둘 다 믿지 않는다.
 *
 * <ul>
 *   <li>{@link #AVAILABLE} — 추천 구간이 있다</li>
 *   <li>{@link #SUPPRESSED_BY_WARNING} — <b>곡선이 좋아도 주지 않는다.</b> 기상청이 나가지
 *       말라고 한 날에 "이때가 좋다"고 말하면 안 된다. 곡선 자체는 그대로 내려간다</li>
 *   <li>{@link #ALL_HOURS_RISKY} — 남은 시각이 전부 위험이다. 이것만이 "오늘은 나가지 않는
 *       편이 좋다"는 <b>판정</b>이다</li>
 *   <li>{@link #NO_FORECAST} — 판정할 예보가 없다. <b>모르는 것을 나쁜 것으로 말하지
 *       않는다</b> — 왜 없는지는 {@link ForecastCoverage} 가 따로 답한다</li>
 * </ul>
 */
@Getter
@RequiredArgsConstructor
public enum GoldenWindowStatus implements CodeNameDescribable {

    AVAILABLE("추천 구간 있음", "오늘 남은 시간 중 산책하기 좋은 구간이 있습니다."),
    SUPPRESSED_BY_WARNING("특보로 추천 보류",
        "기상특보 경보가 발효 중이라 시간대가 좋아도 추천하지 않습니다. 시간대 곡선은 근거로 그대로 제공됩니다."),
    ALL_HOURS_RISKY("남은 시간 모두 위험", "오늘 남은 시각이 전부 위험 등급이라 추천할 구간이 없습니다."),
    NO_FORECAST("판정할 예보 없음", "오늘 남은 시각의 예보가 없어 추천 여부를 판정하지 않았습니다.");

    private final String displayName;
    private final String description;

    /**
     * 곡선과 특보 상태에서 이 값을 정한다. <b>보는 순서가 곧 규칙이다.</b>
     *
     * <p>예보 없음을 가장 먼저 본다 - 곡선이 비었는데 "남은 시간이 전부 위험"이라고 하면
     * 모르는 것을 나쁜 것으로 말하는 것이다. 그다음이 경보다. 경보는 곡선의 내용과 무관하게
     * 추천을 막으므로 곡선 판정보다 위에 있어야 한다.
     *
     * <p>판정을 여기 모아 두는 이유는 <b>화면이 이 순서를 다시 짜지 않게</b> 하기 위해서다.
     * 호출부마다 if 를 세우면 한쪽만 고쳐져 같은 상태에 다른 문구가 나간다.
     *
     * @param hasForecast   오늘 남은 시각의 곡선이 있는지
     * @param warningActive 기상특보 <b>경보</b>가 발효 중인지. 주의보는 여기 해당하지 않는다
     * @param hasWindow     곡선에서 추천할 연속 구간을 찾았는지
     */
    public static GoldenWindowStatus of(boolean hasForecast, boolean warningActive, boolean hasWindow) {
        if (!hasForecast) {
            return NO_FORECAST;
        }
        if (warningActive) {
            return SUPPRESSED_BY_WARNING;
        }
        return hasWindow ? AVAILABLE : ALL_HOURS_RISKY;
    }

    /** 추천 구간이 실제로 있는 상태인지. */
    public boolean hasWindow() {
        return this == AVAILABLE;
    }
}
