package com.hondigagae.domainlayer.plan.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import java.time.LocalDate;
import java.util.Optional;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 그 항목의 산책 위험도를 못 낸 이유.
 *
 * <p>일자 날씨의 {@link PlanDayWeatherUnavailableReason} 과 <b>같은 축</b>이다 — 코드로 내려
 * 화면이 사유별로 다르게 그리게 한다. 못 낸 이유를 하나로 뭉뚱그리면 "시각을 넣으면 풀린다" 와
 * "지난 날짜라 영원히 안 풀린다" 가 같은 문장을 받는다.
 *
 * <p>항목에만 있는 사유가 둘이다.
 * <ul>
 *   <li>{@link #NO_START_TIME} — 시각이 없다. <b>정오를 넣어 판정하지 않는다</b> — 산책 위험도는
 *       시각에 따라 갈리므로 없는 시각을 지어내면 그 판정은 사용자가 정하지 않은 시간의 답이 된다</li>
 *   <li>{@link #NOT_PLACE_TARGET} — 좌표를 아는 장소 항목이 아니다. {@code WALK} 의 {@code targetId}
 *       는 {@code walk_course.id} 라 장소로 조회하면 남의 아이디로 없는 장소를 찾는다
 *       ({@code PlanItemType.isPlaceTarget()})</li>
 * </ul>
 *
 * <p><b>날짜 판정을 직접 갖는다 — {@link PlanDayWeatherUnavailableReason#byDate} 를 빌려 쓰지
 * 않는다.</b> 같은 모양이지만 <b>지평이 다르기 때문</b>이다 ({@link #HOURLY_FORECAST_HORIZON_DAYS}).
 * 일자 예보 지평(11일)으로 가르면 {@code 오늘+5} 이후 항목이 컷에 걸리지 않고 전부 tour-service
 * 로 나가는데, 돌아오는 것은 등급 {@code UNKNOWN} 에 온도가 전부 null 인 200 이다. <b>일주일 뒤
 * 여행의 모든 항목이 쓸모없는 원격 호출을 한 번씩 하고</b>, 기다리면 풀릴 날짜에 "이 시각의
 * 예보가 없다" 는 항목별 사유({@link #NO_FORECAST_AT_TIME})를 받는다 — 날짜로 이미 알 수 있는
 * 것을 항목 수만큼 물어본 셈이다. (#717 이전에는 사유 자체가 없어 화면이 <b>사유 없는 빈 배지</b>를
 * 받았다.)
 *
 * <p>그 {@code UNKNOWN} 은 <b>지평 안에서도</b> 온다. 단기예보는 시간 단위라 지평 안 날짜여도 그
 * 시각만 비는 일이 있고(특히 {@code 오늘+4} 는 실측에서 자정 한 시각만 오는 날이다), 그러면
 * tour-service 가 등급 {@code UNKNOWN} 으로 200 을 돌려준다. {@link #NO_FORECAST_AT_TIME} 이 그
 * 자리를 메운다 — 그 사유가 없으면 여기서도 사유 없는 빈 배지가 나간다.
 *
 * <p><b>{@link #NO_FORECAST_AT_TIME} 을 {@link #BEYOND_FORECAST_RANGE} 로 합치지 않는다.</b>
 * 둘은 갈리는 시점과 단위가 다르다.
 * <ul>
 *   <li>{@link #BEYOND_FORECAST_RANGE} 는 {@link #byDate} 가 <b>날짜만의 함수</b>로 정한다 —
 *       원격 호출 <b>전에</b> 갈리고, 그날 모든 항목이 같은 답을 받으므로 화면이 <b>일자 단위로
 *       접어</b> 낼 수 있다</li>
 *   <li>{@link #NO_FORECAST_AT_TIME} 은 <b>물어본 뒤에야</b> 안다 — 같은 날 안에서도
 *       <b>항목마다 갈린다.</b> 그날 새벽 항목은 답을 받고 낮 항목은 못 받는 일이 실제로 있다</li>
 * </ul>
 * 합치면 화면이 두 줄을 같은 방식으로 그리게 되고, 이미 물어보고 답을 받은 줄에까지
 * "기다리면 풀립니다" 가 나간다.
 */
@Getter
@RequiredArgsConstructor
public enum PlanItemWalkSafetyUnavailableReason implements CodeNameDescribable {

    NO_START_TIME("시각 미지정",
        "이 항목에 시작 시각이 없어 산책 위험도를 낼 수 없습니다. 시각은 시간대마다 판정이 갈립니다."),
    NOT_PLACE_TARGET("장소 항목 아님",
        "좌표를 아는 장소 항목이 아니어서 산책 위험도를 붙이지 못했습니다."),
    PAST_DATE("지난 날짜",
        "이미 지난 날짜라 예보가 남아 있지 않습니다. 이 항목의 산책 위험도는 확인할 수 없습니다."),
    BEYOND_FORECAST_RANGE("예보 범위 밖",
        "산책 위험도는 시각별 예보로만 판정할 수 있고, 그 예보는 오늘부터 5일까지입니다. "
            + "이 날짜는 아직 판정할 수 없습니다."),
    /**
     * <b>문장이 원인을 단정하지 않는다.</b> 이 사유로 접히는 원천 상태가 둘이다 — 그 시각 예보가
     * 정말 없는 것과, tour-service 가 기상 원천 장애({@code WEATHER_UNAVAILABLE})를 빈 예보 목록으로
     * 삼켜 200 을 돌려준 것이다({@code WalkSafetyProcessor.loadForecasts}). 둘 다 등급 {@code UNKNOWN}
     * 으로 와서 이 경계에서는 가를 수 없다. "예보는 시각마다 갈린다" 고 쓰면 장애 중인 사용자에게
     * <b>영구 사실처럼</b> 읽히므로 "쓸 수 없었다" 까지만 말한다.
     */
    NO_FORECAST_AT_TIME("그 시각 예보 없음",
        "이 시각의 예보를 쓸 수 없어 산책 위험도를 내지 못했습니다."),
    LOOKUP_FAILED("조회 실패",
        "산책 위험도를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");

    /**
     * <b>시각별</b> 예보가 닿는 마지막 날짜까지의 일수. 덮는 범위는 {@code [오늘, 오늘+4]} — 5일이다.
     *
     * <p><b>일자 날씨의 {@link PlanDayWeatherUnavailableReason#FORECAST_HORIZON_DAYS}(10) 과 다르고,
     * 그 차이가 이 기능에서 가장 틀리기 쉬운 지점이다.</b> 그쪽은 단기예보(오늘~오늘+4)에
     * 중기예보(오늘+4~오늘+10)를 이어 만든 <b>일자</b> 커버리지다. 산책 위험도는 노면온도를
     * {@code 기온 + 일사(날짜·시각·위도)} 로 추정하므로 <b>시각별 데이터가 있는 단기예보만</b> 쓴다 —
     * 중기예보에는 오전/오후뿐이라 오후 두 시 아스팔트를 계산할 수 없다
     * ({@code backend/docs/weather-insight-integration.md} §2-1 · §6-2).
     *
     * <p>그래서 tour-service 는 <b>시각별 예보 목록이 덮는 날짜</b>로만 판정한다
     * ({@code WeatherForecastProcessor.forecastsAt} → {@code WeatherForecast.coverageOn} →
     * {@code ForecastCoverage.of}). 그 밖이면 {@code OUT_OF_RANGE} 가 되고
     * {@code WalkSafetyEvaluator} 가 {@code WalkSafetyAssessment.unknown} 을 낸다. 단기예보의
     * 실측 커버리지가 {@code 오늘 ~ 오늘+4}(§2 표)이므로 이 상수는 4다 — 임의의 숫자가 아니다.
     * <b>원천 커버리지가 바뀌면 이 상수도 같이 움직인다.</b>
     *
     * <p>{@code 오늘+4} 는 실측에서 자정 한 시각만 오는 날이라(§5-1) 낮 항목은 대개 판정이 비어
     * 돌아온다. 그래도 여기서 미리 자르지 않는다 — <b>날짜만으로 답이 정해지지 않기 때문이다.</b>
     * 그날 새벽 항목은 실제로 답을 받는다. 비어 돌아온 낮 항목은 {@link #NO_FORECAST_AT_TIME} 이 받는다.
     */
    public static final int HOURLY_FORECAST_HORIZON_DAYS = 4;

    private final String displayName;
    private final String description;

    /**
     * 날짜만으로 정해지는 사유.
     *
     * <p>항목에 시각이 있든 없든, 장소 항목이든 아니든, tour-service 가 살아 있든 아니든 결과가
     * 같은 날을 가른다. 비어 있으면 시각별 예보가 덮을 수 있는 날짜라 실제로 물어봐야 안다.
     *
     * @param today 서비스 기준 오늘 (KST). 시스템 시각을 직접 읽지 않는다 — 호출부가 {@code Clock} 에서 얻는다
     */
    public static Optional<PlanItemWalkSafetyUnavailableReason> byDate(LocalDate date, LocalDate today) {
        if (date.isBefore(today)) {
            return Optional.of(PAST_DATE);
        }
        if (date.isAfter(today.plusDays(HOURLY_FORECAST_HORIZON_DAYS))) {
            return Optional.of(BEYOND_FORECAST_RANGE);
        }
        return Optional.empty();
    }
}
