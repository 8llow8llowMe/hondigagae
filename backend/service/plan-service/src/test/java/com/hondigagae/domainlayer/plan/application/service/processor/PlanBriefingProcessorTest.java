package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.WalkTimesQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.WeatherWarningQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlaceSummaryQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.WalkTimesQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.WeatherWarningQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWalkTimesUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWarningUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 하루치 여행 브리핑 조립 검증.
 *
 * <p>고정하는 것은 넷이다.
 * <ul>
 *   <li><b>오늘만</b> — 특보·골든타임은 요청 날짜가 오늘일 때만 tour-service 에 묻는다. 내일 브리핑에는 호출 자체가 없다
 *   <li><b>특보 "확인 못 함" 과 "없음" 을 나눈다</b> — 조회 실패는 사유 enum 으로, 정말 없음은 둘 다 null 로
 *   <li><b>사유가 갈린다</b> — 못 붙인 이유를 {@code NOT_TODAY} / {@code NO_PLACE_ITEM} / {@code NO_PLACE_POINT} /
 *       {@code LOOKUP_FAILED} 로 가른다. 넷 중 {@code LOOKUP_FAILED} 만 일시 장애라 화면이 재시도 버튼을 붙일 수 있다 (#716)
 *   <li><b>재계산하지 않는다</b> — 골든타임·특보는 받은 값을 그대로 옮기고, 경보 판정(recommendationSuppressed)도 tour 값이다
 *   <li><b>기준 아이</b> — 날씨 판정이 고른 아이(점수가 가장 낮은 아이)의 조건으로 골든타임을 묻는다
 * </ul>
 *
 * <p>"오늘" 은 {@link Clock} 으로 고정한다 (#492). 시스템 시각을 쓰면 브리핑의 "오늘" 과 날씨 판정의
 * "지난 날짜" 가 자정 경계에서 어긋날 수 있고, 그 어긋남은 실행 시각에만 재현돼 테스트로 잡히지 않는다.
 */
class PlanBriefingProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long PLAN_ID = 900L;
    private static final long PLACE_ID = 100L;
    private static final long MONGSIL = 2L;
    private static final long BORI = 5L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 12);
    private static final LocalDate TOMORROW = TODAY.plusDays(1);
    private static final Clock CLOCK = Clock.fixed(TODAY.atStartOfDay(SEOUL).toInstant(), SEOUL);

    private static final PetConditionQueryResult HEAT_SENSITIVE = PetConditionQueryResult.builder()
        .sizeType("SMALL").heatSensitive(true).build();
    private static final PetConditionQueryResult ROBUST = PetConditionQueryResult.builder()
        .sizeType("LARGE").build();

    private PlanItemRepositoryPort planItemRepositoryPort;
    private PlanPlaceLookupPort planPlaceLookupPort;
    private PetConditionQueryPort petConditionQueryPort;
    private PlaceSuitabilityQueryPort placeSuitabilityQueryPort;
    private WeatherWarningQueryPort weatherWarningQueryPort;
    private WalkTimesQueryPort walkTimesQueryPort;
    private PlanBriefingProcessor processor;

    @BeforeEach
    void setUp() {
        planItemRepositoryPort = mock(PlanItemRepositoryPort.class);
        planPlaceLookupPort = mock(PlanPlaceLookupPort.class);
        petConditionQueryPort = mock(PetConditionQueryPort.class);
        placeSuitabilityQueryPort = mock(PlaceSuitabilityQueryPort.class);
        weatherWarningQueryPort = mock(WeatherWarningQueryPort.class);
        walkTimesQueryPort = mock(WalkTimesQueryPort.class);

        // 날씨는 실제 Processor 를 끼운다 — 브리핑이 같은 판정 경로를 타는지가 검증 대상이다.
        PlanWeatherProcessor planWeatherProcessor = new PlanWeatherProcessor(
            planItemRepositoryPort, petConditionQueryPort, new StubPlanPetConditionRepositoryPort(),
            placeSuitabilityQueryPort, CLOCK);
        processor = new PlanBriefingProcessor(
            planItemRepositoryPort, planPlaceLookupPort, planWeatherProcessor, weatherWarningQueryPort,
            walkTimesQueryPort, CLOCK);

        when(petConditionQueryPort.findConditions(anyLong(), anyList()))
            .thenReturn(Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST));
        // 더위에 민감한 몽실이가 점수가 낮다 → 그날의 기준 아이
        when(placeSuitabilityQueryPort.findSuitability(anyLong(), any(), eq(HEAT_SENSITIVE)))
            .thenReturn(Optional.of(suitability(42)));
        when(placeSuitabilityQueryPort.findSuitability(anyLong(), any(), eq(ROBUST)))
            .thenReturn(Optional.of(suitability(81)));
        when(planPlaceLookupPort.findSummaries(List.of(PLACE_ID))).thenReturn(List.of(
            PlanPlaceSummaryQueryResult.builder().placeId(PLACE_ID).title("협재해수욕장").lat(33.39).lng(126.24).build()));
    }

    /** 오늘~내일 1박 2일. 1일차가 오늘, 2일차가 내일이다. */
    private static Plan plan() {
        return Plan.builder()
            .id(PLAN_ID).memberId(MEMBER_ID).petId(MONGSIL).areaCode("39").title("몽실이·보리와 제주 1박 2일")
            .startDate(TODAY).endDate(TOMORROW).status(PlanStatus.DRAFT).build();
    }

    private static PlanItem item(long id, int day, int sequence, PlanItemType type, Long targetId, String title, LocalTime at, boolean visited) {
        return PlanItem.builder().id(id).planId(PLAN_ID).day(day).sequence(sequence)
            .itemType(type).targetId(targetId).title(title).startTime(at).visited(visited).build();
    }

    private void givenItems(PlanItem... items) {
        when(planItemRepositoryPort.findByPlanId(PLAN_ID)).thenReturn(List.of(items));
    }

    private static PlaceSuitabilityQueryResult suitability(int score) {
        return PlaceSuitabilityQueryResult.builder()
            .placeId(PLACE_ID).placeTitle("협재해수욕장").targetDate(TODAY).score(score)
            .levelCode("MEDIUM").levelName("보통").reasons(List.of()).indoorAlternatives(List.of()).build();
    }

    private static WalkTimesQueryResult walkTimes() {
        return WalkTimesQueryResult.builder()
            .from(LocalDateTime.of(TODAY, LocalTime.of(13, 0)))
            .forecastCoverageCode("AVAILABLE").forecastCoverageName("예보 있음")
            .goldenStart(LocalDateTime.of(TODAY, LocalTime.of(18, 0)))
            .goldenEnd(LocalDateTime.of(TODAY, LocalTime.of(21, 0)))
            .goldenLevelCode("SAFE").goldenLevelName("안전")
            .goldenWindowStatusCode("AVAILABLE").goldenWindowStatusName("추천 구간 있음")
            .petConditionApplied(true)
            .build();
    }

    @Test
    @DisplayName("일정 기간 밖 날짜는 PLAN_002 — 브리핑을 지어내지 않는다")
    void rejectsDateOutsidePlan() {
        assertThatThrownBy(() -> processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY.plusDays(5)))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PLAN_DAY_OUT_OF_RANGE);
        assertThatThrownBy(() -> processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY.minusDays(1)))
            .isInstanceOf(PlanException.class);
    }

    @Test
    @DisplayName("내일 브리핑 — 특보·골든타임은 묻지 않고 사유는 NOT_TODAY. 일정 요약은 그날 항목만 센다")
    void tomorrowSkipsTodayOnlySections() {
        givenItems(
            item(1L, 1, 0, PlanItemType.PLACE, PLACE_ID, "오늘 장소", LocalTime.of(9, 0), true),
            item(2L, 2, 1, PlanItemType.MEAL, null, "점심", LocalTime.of(12, 30), false),
            item(3L, 2, 0, PlanItemType.PLACE, PLACE_ID, "협재해수욕장", LocalTime.of(10, 0), true),
            item(4L, 2, 2, PlanItemType.LODGING, null, "숙소 체크인", null, false));

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TOMORROW);

        assertThat(info.day()).isEqualTo(2);
        assertThat(info.date()).isEqualTo(TOMORROW);
        assertThat(info.today()).isFalse();

        // 일정 요약 — 2일차 항목 3개, sequence 순으로 첫/마지막
        assertThat(info.schedule().itemCount()).isEqualTo(3);
        assertThat(info.schedule().visitedCount()).isEqualTo(1);
        assertThat(info.schedule().firstItem().title()).isEqualTo("협재해수욕장");
        assertThat(info.schedule().firstItem().startTime()).isEqualTo(LocalTime.of(10, 0));
        assertThat(info.schedule().lastItem().title()).isEqualTo("숙소 체크인");
        assertThat(info.schedule().lastItem().startTime()).isNull();
        assertThat(info.schedule().representativePlaceId()).isEqualTo(PLACE_ID);
        assertThat(info.schedule().representativeLat()).isEqualTo(33.39);

        // 날씨는 같은 Processor — 기준 아이는 점수가 낮은 몽실이
        assertThat(info.weather().basisPetId()).isEqualTo(MONGSIL);
        assertThat(info.weather().suitability().score()).isEqualTo(42);
        assertThat(info.basisPetId()).isEqualTo(MONGSIL);
        assertThat(info.petConditionApplied()).isTrue();

        // 오늘이 아니라 특보·골든타임은 호출 자체가 없다. 사유는 장애가 아닌 NOT_TODAY 다
        assertThat(info.weatherWarning()).isNull();
        assertThat(info.weatherWarningUnavailableReason())
            .isEqualTo(PlanBriefingWarningUnavailableReason.NOT_TODAY);
        assertThat(info.walkTimes()).isNull();
        assertThat(info.walkTimesUnavailableReason())
            .isEqualTo(PlanBriefingWalkTimesUnavailableReason.NOT_TODAY);
        verify(weatherWarningQueryPort, never()).findActiveWarning();
        verify(walkTimesQueryPort, never()).findWalkTimes(anyDouble(), anyDouble(), any());
    }

    @Test
    @DisplayName("오늘 브리핑 — 특보와 골든타임을 그대로 중계하고, 골든타임은 기준 아이(몽실이)의 조건으로 묻는다")
    void todayRelaysWarningAndWalkTimesForBasisPet() {
        givenItems(item(1L, 1, 0, PlanItemType.PLACE, PLACE_ID, "협재해수욕장", LocalTime.of(10, 0), false));
        when(weatherWarningQueryPort.findActiveWarning()).thenReturn(Optional.of(WeatherWarningQueryResult.builder()
            .typeCode("TYPHOON").typeName("태풍").levelCode("WARNING").levelName("경보")
            .recommendationSuppressed(true).build()));
        when(walkTimesQueryPort.findWalkTimes(eq(33.39), eq(126.24), eq(HEAT_SENSITIVE)))
            .thenReturn(Optional.of(walkTimes()));

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY);

        assertThat(info.today()).isTrue();
        assertThat(info.weatherWarning().typeCode()).isEqualTo("TYPHOON");
        // 경보 판정은 tour 가 준 값 그대로 — 이쪽에서 levelCode 로 다시 세우지 않는다
        assertThat(info.weatherWarning().recommendationSuppressed()).isTrue();
        assertThat(info.weatherWarningUnavailableReason()).isNull();

        assertThat(info.walkTimes().goldenStart()).isEqualTo(LocalDateTime.of(TODAY, LocalTime.of(18, 0)));
        assertThat(info.walkTimes().goldenWindowStatusCode()).isEqualTo("AVAILABLE");
        assertThat(info.walkTimesUnavailableReason()).isNull();
        verify(walkTimesQueryPort).findWalkTimes(33.39, 126.24, HEAT_SENSITIVE);
    }

    @Test
    @DisplayName("오늘 특보가 없으면 특보 필드와 이유가 둘 다 null — 그것만이 '발효 중인 특보 없음' 이다")
    void noWarningLeavesBothFieldsNull() {
        givenItems(item(1L, 1, 0, PlanItemType.PLACE, PLACE_ID, "협재해수욕장", null, false));
        when(weatherWarningQueryPort.findActiveWarning()).thenReturn(Optional.empty());
        when(walkTimesQueryPort.findWalkTimes(anyDouble(), anyDouble(), any())).thenReturn(Optional.of(walkTimes()));

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY);

        assertThat(info.weatherWarning()).isNull();
        assertThat(info.weatherWarningUnavailableReason()).isNull();
    }

    @Test
    @DisplayName("특보 조회 실패는 '없음' 으로 접지 않는다 — LOOKUP_FAILED 라 화면이 '확인 못 함' 과 재시도를 말할 수 있다")
    void warningLookupFailureIsDistinguishedFromNoWarning() {
        givenItems(item(1L, 1, 0, PlanItemType.PLACE, PLACE_ID, "협재해수욕장", null, false));
        when(weatherWarningQueryPort.findActiveWarning())
            .thenThrow(new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE));
        when(walkTimesQueryPort.findWalkTimes(anyDouble(), anyDouble(), any())).thenReturn(Optional.of(walkTimes()));

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY);

        assertThat(info.weatherWarning()).isNull();
        // NOT_TODAY 와 갈려야 화면이 재시도 버튼을 붙일지 판단할 수 있다
        assertThat(info.weatherWarningUnavailableReason())
            .isEqualTo(PlanBriefingWarningUnavailableReason.LOOKUP_FAILED);
        // 특보 실패가 나머지 브리핑을 막지 않는다
        assertThat(info.walkTimes()).isNotNull();
        assertThat(info.weather().suitability().score()).isEqualTo(42);
    }

    @Test
    @DisplayName("오늘인데 장소 항목이 없으면 골든타임 사유는 NO_PLACE_ITEM — 장소 요약·골든타임 조회가 나가지 않는다")
    void todayWithoutPlaceItemSkipsWalkTimes() {
        givenItems(item(1L, 1, 0, PlanItemType.MOVE, null, "공항 이동", LocalTime.of(8, 0), false));
        when(weatherWarningQueryPort.findActiveWarning()).thenReturn(Optional.empty());

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY);

        assertThat(info.schedule().itemCount()).isEqualTo(1);
        assertThat(info.schedule().representativePlaceId()).isNull();
        assertThat(info.weather().unavailableReason()).isNotNull();
        // 날씨 판정이 기준 아이를 못 고르면 대표(첫 번째)가 기준이다
        assertThat(info.basisPetId()).isEqualTo(MONGSIL);
        assertThat(info.walkTimes()).isNull();
        // 장애가 아니라 일정의 문제다 — 사용자가 장소를 담으면 풀린다
        assertThat(info.walkTimesUnavailableReason())
            .isEqualTo(PlanBriefingWalkTimesUnavailableReason.NO_PLACE_ITEM);
        verify(planPlaceLookupPort, never()).findSummaries(anyList());
        verify(walkTimesQueryPort, never()).findWalkTimes(anyDouble(), anyDouble(), any());
        // 특보는 장소와 무관하게 오늘이면 확인한다
        verify(weatherWarningQueryPort).findActiveWarning();
    }

    @Test
    @DisplayName("대표 장소가 delisted 라 좌표가 없으면 골든타임 사유는 NO_PLACE_POINT — 항목은 그대로 남는다")
    void todayWithoutPointSkipsWalkTimes() {
        givenItems(item(1L, 1, 0, PlanItemType.PLACE, PLACE_ID, "사라진 장소", null, false));
        when(planPlaceLookupPort.findSummaries(List.of(PLACE_ID))).thenReturn(List.of());
        when(weatherWarningQueryPort.findActiveWarning()).thenReturn(Optional.empty());

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY);

        assertThat(info.schedule().representativePlaceId()).isEqualTo(PLACE_ID);
        assertThat(info.schedule().representativeLat()).isNull();
        assertThat(info.walkTimes()).isNull();
        // 장소는 있는데 좌표가 없는 것이라 NO_PLACE_ITEM 과 갈린다 — 화면이 하는 말이 다르다
        assertThat(info.walkTimesUnavailableReason())
            .isEqualTo(PlanBriefingWalkTimesUnavailableReason.NO_PLACE_POINT);
        verify(walkTimesQueryPort, never()).findWalkTimes(anyDouble(), anyDouble(), any());
    }

    @Test
    @DisplayName("요약은 왔는데 원천이 좌표를 주지 않은 장소도 NO_PLACE_POINT — 좌표는 null 로 흐르고 0.0 으로 접지 않는다")
    void todayWithSummaryButNoPointSkipsWalkTimes() {
        givenItems(item(1L, 1, 0, PlanItemType.PLACE, PLACE_ID, "좌표 없는 장소", null, false));
        // delisted 라 요약이 아예 안 오는 쪽과 다른 갈래다 — 요약 객체는 손에 있는데 좌표만 null 이다.
        when(planPlaceLookupPort.findSummaries(List.of(PLACE_ID))).thenReturn(List.of(
            PlanPlaceSummaryQueryResult.builder().placeId(PLACE_ID).title("좌표 없는 장소").lat(null).lng(null).build()));
        when(weatherWarningQueryPort.findActiveWarning()).thenReturn(Optional.empty());

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY);

        // 좌표를 0.0 으로 접으면 적도상의 한 점이 된다 — null 이 null 로 흘러야 한다.
        assertThat(info.schedule().representativeLat()).isNull();
        assertThat(info.schedule().representativeLng()).isNull();
        // 요약이 왔으므로 이름은 남는다 — 좌표만 없는 상태가 delisted 와 구분된다.
        assertThat(info.schedule().representativePlaceId()).isEqualTo(PLACE_ID);
        assertThat(info.walkTimes()).isNull();
        assertThat(info.walkTimesUnavailableReason())
            .isEqualTo(PlanBriefingWalkTimesUnavailableReason.NO_PLACE_POINT);
        verify(walkTimesQueryPort, never()).findWalkTimes(anyDouble(), anyDouble(), any());
    }

    @Test
    @DisplayName("골든타임 조회 실패는 빈 값으로 접고 사유는 LOOKUP_FAILED — 부가 정보라 브리핑을 막지 않는다")
    void walkTimesLookupFailureLeavesReason() {
        givenItems(item(1L, 1, 0, PlanItemType.PLACE, PLACE_ID, "협재해수욕장", null, false));
        when(weatherWarningQueryPort.findActiveWarning()).thenReturn(Optional.empty());
        when(walkTimesQueryPort.findWalkTimes(anyDouble(), anyDouble(), any())).thenReturn(Optional.empty());

        PlanBriefingInfo info = processor.brief(MEMBER_ID, plan(), List.of(MONGSIL, BORI), TODAY);

        assertThat(info.walkTimes()).isNull();
        // 넷 중 이것만 일시 장애다 — 화면이 재시도를 권해도 되는 유일한 사유다
        assertThat(info.walkTimesUnavailableReason())
            .isEqualTo(PlanBriefingWalkTimesUnavailableReason.LOOKUP_FAILED);
    }
}
