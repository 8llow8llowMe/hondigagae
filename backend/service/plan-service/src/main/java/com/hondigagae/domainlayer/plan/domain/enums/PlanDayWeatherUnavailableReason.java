package com.hondigagae.domainlayer.plan.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import java.time.LocalDate;
import java.util.Optional;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 그 일자의 판정을 못 낸 이유.
 *
 * <p><b>"못 냈다" 에는 성질이 다른 넷이 섞여 있다.</b> 뭉뚱그리면 사용자에게 하는 말이 틀린다 —
 * 지난 날짜에 "잠시 후 다시 시도해 주세요" 라고 하면 <b>영원히 지켜지지 않을 안내</b>가 된다
 * (#492). 화면은 이 문장을 그대로 보여 주고 사용자는 새로고침을 반복한다.
 *
 * <ul>
 *   <li>{@link #PAST_DATE} — 이미 지난 날짜다. 예보는 <b>과거로 소급되지 않으므로</b> 다시
 *       물어도 생기지 않는다. 재시도를 권하지 않는다</li>
 *   <li>{@link #NO_PLACE_ITEM} — 그날 일정에 장소가 없다. 날씨의 문제가 아니라 일정의 문제라
 *       사용자가 장소를 담으면 풀린다</li>
 *   <li>{@link #BEYOND_FORECAST_RANGE} — 예보가 아직 닿지 않는 미래다. 기다리면 풀린다</li>
 *   <li>{@link #LOOKUP_FAILED} — 조회 자체가 실패했다. <b>이것만 장애다</b></li>
 * </ul>
 *
 * <p>tour-service 의 {@code ForecastCoverage} 와 같은 구분을 일정 쪽 말로 옮긴 것이다. 그쪽은
 * 예보 목록을 손에 들고 판정하지만, 여기는 <b>날짜만으로 답이 정해지는 둘</b>(지난 날짜 ·
 * 예보 범위 밖)을 원격 호출 전에 가른다 — 물어도 결과가 정해져 있는 날에 호출을 내보내지
 * 않는다. 3박 4일 중 사흘이 지난 일정이면 나가는 호출이 하루치로 준다.
 *
 * <p>코드는 응답의 {@code unavailableReasonCode} 로 그대로 나간다. 문장만 내리면 프론트가
 * 사유별로 다르게 그릴 수 없다 (#497).
 */
@Getter
@RequiredArgsConstructor
public enum PlanDayWeatherUnavailableReason implements CodeNameDescribable {

    PAST_DATE("지난 날짜",
        "이미 지난 날짜라 예보가 남아 있지 않습니다. 이 날의 날씨 판정은 확인할 수 없습니다."),
    NO_PLACE_ITEM("장소 미지정",
        "이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다."),
    BEYOND_FORECAST_RANGE("예보 범위 밖",
        "예보는 오늘부터 11일까지만 제공되어 이 날짜는 아직 판정할 수 없습니다."),
    LOOKUP_FAILED("조회 실패",
        "날씨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");

    /**
     * 예보가 닿는 마지막 날짜까지의 일수. 덮는 범위는 {@code [오늘, 오늘+10]} — 11일이다.
     *
     * <p>기상청 단기예보(오늘~오늘+4)와 중기예보(오늘+4~오늘+10)를 이어 만든 값이라 임의의
     * 숫자가 아니다 ({@code backend/docs/weather-insight-integration.md} §2). 원천이 바뀌면
     * 이 상수도 같이 움직인다.
     */
    public static final int FORECAST_HORIZON_DAYS = 10;

    private final String displayName;
    private final String description;

    /**
     * 날짜만으로 정해지는 사유.
     *
     * <p>일정에 장소가 있든 없든, tour-service 가 살아 있든 아니든 결과가 같은 날을 가른다.
     * 비어 있으면 예보가 덮는 날짜라 실제로 물어봐야 안다.
     *
     * @param today 서비스 기준 오늘 (KST). 시스템 시각을 직접 읽지 않는다 — 호출부가 {@code Clock} 에서 얻는다
     */
    public static Optional<PlanDayWeatherUnavailableReason> byDate(LocalDate date, LocalDate today) {
        if (date.isBefore(today)) {
            return Optional.of(PAST_DATE);
        }
        if (date.isAfter(today.plusDays(FORECAST_HORIZON_DAYS))) {
            return Optional.of(BEYOND_FORECAST_RANGE);
        }
        return Optional.empty();
    }
}
