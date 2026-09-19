package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemWalkSafetyItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWalkSafetyResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanWalkSafetyPresenter;
import com.hondigagae.domainlayer.plan.application.info.PlanWalkSafetyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWalkSafetyInfo.PlanItemWalkSafetyInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceWalkSafetyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceWalkSafetyQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemWalkSafetyUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPetCondition;
import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 항목 단위 산책 위험도 (#624).
 *
 * <p>고정하는 것은 넷이다.
 * <ul>
 *   <li><b>항목의 시각으로 묻는다</b> — 같은 장소도 오후 2시와 저녁 7시가 다르다. 시각이 없으면
 *       정오를 지어내지 않고 사유를 낸다</li>
 *   <li><b>같은 (장소, 시각, 기준 반려견) 은 한 번만 묻는다</b> — 항목마다 부르면 일정 하나에
 *       원격 호출이 항목 수만큼 생긴다</li>
 *   <li><b>기준 반려견은 그날 날씨 판정과 같다</b> — 두 화면이 같은 날을 다른 아이 기준으로
 *       말하면 사용자는 어느 쪽을 믿어야 할지 모른다</li>
 *   <li><b>못 낸 이유를 여섯으로 가른다</b> — 뭉뚱그리면 지난 날짜에 "시각을 넣어 보세요" 라는
 *       지켜지지 않을 안내가 나간다</li>
 *   <li><b>지평은 시각별 예보의 것이다</b> — 일자 날씨의 11일로 가르면 {@code 오늘+5} 이후가
 *       전부 원격으로 나가 사유 없는 빈 판정으로 돌아온다</li>
 *   <li><b>지평 안에서 그 시각만 빈 것은 다른 사유다</b> ({@code NO_FORECAST_AT_TIME}, #717) —
 *       날짜만으로 갈리는 {@code BEYOND_FORECAST_RANGE} 와 달리 <b>항목마다</b> 갈리고, 물어본
 *       줄이라 등급 {@code UNKNOWN} 과 장소·기준 반려견이 함께 남는다</li>
 *   <li><b>못 낸 줄도 장소를 들고 있다</b> — 그래야 화면이 그 줄에서 장소 위험도 API 를 직접 부른다</li>
 * </ul>
 *
 * <p>"오늘" 은 {@link Clock} 으로 고정한다 — {@code DAY_1} 이 오늘이다.
 */
class PlanWalkSafetyProcessorTest {

    private static final long PLAN_ID = 900L;
    private static final long PLACE_ID = 100L;
    private static final long OTHER_PLACE_ID = 101L;
    private static final long WALK_COURSE_ID = 700L;
    private static final long MONGSIL = 2L;
    private static final long BORI = 5L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final LocalDate DAY_1 = LocalDate.of(2026, 9, 12);
    private static final Clock CLOCK = Clock.fixed(DAY_1.atStartOfDay(SEOUL).toInstant(), SEOUL);

    private static final PetConditionQueryResult HEAT_SENSITIVE = PetConditionQueryResult.builder()
        .sizeType("SMALL").heatSensitive(true).build();
    private static final PetConditionQueryResult ROBUST = PetConditionQueryResult.builder()
        .sizeType("LARGE").build();

    private StubPlanItemRepositoryPort planItemRepositoryPort;
    private StubPetConditionQueryPort petConditionQueryPort;
    private StubPlanPetConditionRepositoryPort planPetConditionRepositoryPort;
    private StubPlaceSuitabilityQueryPort placeSuitabilityQueryPort;
    private StubPlaceWalkSafetyQueryPort placeWalkSafetyQueryPort;
    private PlanWalkSafetyProcessor processor;

    @BeforeEach
    void setUp() {
        planItemRepositoryPort = new StubPlanItemRepositoryPort();
        petConditionQueryPort = new StubPetConditionQueryPort();
        planPetConditionRepositoryPort = new StubPlanPetConditionRepositoryPort();
        placeSuitabilityQueryPort = new StubPlaceSuitabilityQueryPort();
        placeWalkSafetyQueryPort = new StubPlaceWalkSafetyQueryPort();
        PlanWeatherProcessor weatherProcessor = new PlanWeatherProcessor(
            planItemRepositoryPort, petConditionQueryPort, planPetConditionRepositoryPort,
            placeSuitabilityQueryPort, CLOCK);
        processor = new PlanWalkSafetyProcessor(
            planItemRepositoryPort, placeWalkSafetyQueryPort, weatherProcessor, CLOCK);
    }

    @Test
    @DisplayName("항목마다 그 항목의 시각으로 묻는다 — 같은 장소도 오후 2시와 저녁 7시가 다르다")
    void asksWithEachItemStartTime() {
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 1, 1, PLACE_ID, LocalTime.of(19, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(placeWalkSafetyQueryPort.askedAt).containsExactlyInAnyOrder(
            DAY_1.atTime(14, 0), DAY_1.atTime(19, 0));
        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::levelCode).containsExactly("DANGER", "DANGER");
        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::unavailableReason).containsOnlyNulls();
    }

    @Test
    @DisplayName("같은 장소·같은 시각·같은 기준 반려견이면 한 번만 묻는다 — 항목 수만큼 왕복하지 않는다")
    void foldsIdenticalLookups() {
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 1, 1, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(placeWalkSafetyQueryPort.calls).isEqualTo(1);
        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::levelCode).containsExactly("DANGER", "DANGER");
    }

    @Test
    @DisplayName("장소가 달라지면 접지 않는다 — 접는 것은 같은 답이 나올 때뿐이다")
    void doesNotFoldDifferentPlaces() {
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 1, 1, OTHER_PLACE_ID, LocalTime.of(14, 0)));

        processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(placeWalkSafetyQueryPort.calls).isEqualTo(2);
    }

    @Test
    @DisplayName("시각이 없는 항목은 NO_START_TIME 이고 묻지 않는다 — 없는 시각을 정오로 지어내지 않는다")
    void itemWithoutStartTimeIsUnavailable() {
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, null));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(only(info).unavailableReason()).isEqualTo(PlanItemWalkSafetyUnavailableReason.NO_START_TIME);
        assertThat(only(info).levelCode()).isNull();
        assertThat(placeWalkSafetyQueryPort.calls).isZero();
    }

    @Test
    @DisplayName("올레 코스 항목은 NOT_PLACE_TARGET 이다 — WALK 의 targetId 는 walk_course.id 라 장소로 조회하면 남의 아이디다")
    void walkItemIsNotAPlaceTarget() {
        planItemRepositoryPort.items = List.of(walkItem(1000L, 1, 0, LocalTime.of(9, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(only(info).unavailableReason())
            .isEqualTo(PlanItemWalkSafetyUnavailableReason.NOT_PLACE_TARGET);
        assertThat(placeWalkSafetyQueryPort.calls).isZero();
    }

    @Test
    @DisplayName("지난 날짜는 무엇을 고쳐도 풀리지 않으므로 먼저 가른다 — 시각이 없어도 PAST_DATE 다")
    void pastDateWinsOverOtherReasons() {
        LocalDate yesterday = DAY_1.minusDays(1);
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, null));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(yesterday, yesterday), List.of(MONGSIL));

        assertThat(only(info).unavailableReason()).isEqualTo(PlanItemWalkSafetyUnavailableReason.PAST_DATE);
        assertThat(placeWalkSafetyQueryPort.calls).isZero();
    }

    @Test
    @DisplayName("예보 범위 밖은 기다리면 풀리므로 고칠 수 있는 사유를 먼저 말한다")
    void beyondForecastRangeComesAfterFixableReasons() {
        LocalDate farFuture = DAY_1.plusDays(30);
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 1, 1, PLACE_ID, null));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(farFuture, farFuture), List.of(MONGSIL));

        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::unavailableReason).containsExactly(
            PlanItemWalkSafetyUnavailableReason.BEYOND_FORECAST_RANGE,
            PlanItemWalkSafetyUnavailableReason.NO_START_TIME);
        assertThat(placeWalkSafetyQueryPort.calls).isZero();
    }

    @Test
    @DisplayName("조회에 실패한 항목은 LOOKUP_FAILED 로 비우고 나머지는 그대로 낸다")
    void lookupFailureEmptiesOnlyThatItem() {
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));
        placeWalkSafetyQueryPort.unavailable = true;

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(only(info).unavailableReason()).isEqualTo(PlanItemWalkSafetyUnavailableReason.LOOKUP_FAILED);
        // 항목 줄 자체는 남는다 — 화면은 그 항목을 여전히 그려야 한다.
        assertThat(only(info).title()).isEqualTo("협재해수욕장");
        assertThat(only(info).planItemId()).isEqualTo(1000L);
    }

    @Test
    @DisplayName("기준 반려견은 그날 날씨 판정의 basisPetId 와 같다 — 점수가 가장 낮은 아이 조건으로 묻는다")
    void basisPetFollowsDayWeather() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST);
        placeSuitabilityQueryPort.scoreOf = condition -> condition.heatSensitive() ? 42 : 81;
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(BORI, MONGSIL));

        assertThat(only(info).basisPetId()).isEqualTo(MONGSIL);
        // 대표(첫 번째)인 보리가 아니라, 그날 기준인 몽실이 조건으로 물어야 한다.
        assertThat(placeWalkSafetyQueryPort.askedWith).singleElement()
            .satisfies(condition -> assertThat(condition.heatSensitive()).isTrue());
    }

    @Test
    @DisplayName("일차가 늘면 날짜도 함께 늘어난다 — 같은 장소 같은 시:분이라도 날이 다르면 접지 않는다")
    void asksPerDayDateAndDoesNotFoldAcrossDays() {
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 3, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1.plusDays(2)), List.of(MONGSIL));

        assertThat(placeWalkSafetyQueryPort.calls).isEqualTo(2);
        assertThat(placeWalkSafetyQueryPort.askedAt)
            .containsExactly(DAY_1.atTime(14, 0), DAY_1.plusDays(2).atTime(14, 0));
        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::date)
            .containsExactly(DAY_1, DAY_1.plusDays(2));
        // 그날 기준 반려견을 구하는 쪽도 같은 날을 본다. 어긋나면 3일차 항목이 1일차 날씨로 뽑힌
        // 기준 반려견으로 판정된다 — 화면 둘이 같은 날을 다른 아이 기준으로 말하게 된다.
        assertThat(placeSuitabilityQueryPort.askedDates).containsExactly(DAY_1, DAY_1.plusDays(2));
    }

    @Test
    @DisplayName("판정할 항목이 없는 날은 기준 반려견도 구하지 않는다 — 쓰지도 않을 값 때문에 원격 호출을 내보내지 않는다")
    void doesNotResolveBasisPetForDaysWithNothingToAssess() {
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 2, 0, PLACE_ID, null));

        processor.assess(1L, plan(DAY_1, DAY_1.plusDays(1)), List.of(MONGSIL));

        assertThat(placeSuitabilityQueryPort.askedDates).containsExactly(DAY_1);
    }

    @Test
    @DisplayName("그날 적합도 조회가 실패하면 대표(첫 번째) 반려견으로 대신한다 — 기준이 없다고 항목 판정까지 포기하지 않는다")
    void fallsBackToRepresentativePetWhenDayBasisIsUnavailable() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST);
        placeSuitabilityQueryPort.unavailable = true;
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(BORI, MONGSIL));

        assertThat(only(info).basisPetId()).isEqualTo(BORI);
        assertThat(placeWalkSafetyQueryPort.askedWith).singleElement()
            .satisfies(condition -> assertThat(condition.heatSensitive()).isFalse());
        // 기준을 못 냈다고 항목 줄까지 비우지 않는다.
        assertThat(only(info).levelCode()).isEqualTo("DANGER");
    }

    @Test
    @DisplayName("완료된 일정은 완료 시점 스냅샷 조건으로 묻는다 — 다녀온 뒤 프로필을 고쳤다고 '그때 몽실이 기준' 이 달라지면 기록이 거짓이 된다")
    void completedPlanAsksWithSnapshotCondition() {
        // 원천에는 지금 둔감한 조건이 들어 있다. 스냅샷을 쓴다면 이 값은 쓰이지 않아야 한다.
        petConditionQueryPort.conditions = Map.of(MONGSIL, ROBUST);
        planPetConditionRepositoryPort.saveAll(List.of(
            PlanPetCondition.of(1L, PLAN_ID, MONGSIL, HEAT_SENSITIVE)));
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));

        processor.assess(1L, completedPlan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(placeWalkSafetyQueryPort.askedWith).singleElement()
            .satisfies(condition -> assertThat(condition.heatSensitive()).isTrue());
        assertThat(petConditionQueryPort.calls).isZero();
    }

    @Test
    @DisplayName("시각별 예보 지평 밖은 묻기 전에 가른다 — 일자 날씨의 11일로 가르면 오늘+5 가 사유 없는 빈 판정으로 돌아온다")
    void cutsBeyondHourlyForecastHorizonBeforeTheRemoteCall() {
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 5, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 6, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1.plusDays(5)), List.of(MONGSIL));

        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::unavailableReason).containsExactly(
            // 오늘+4 는 단기예보가 아직 덮는 날이라 물어본다.
            null,
            // 오늘+5 부터는 시각별 예보가 없어 물어도 UNKNOWN 이 돌아온다.
            PlanItemWalkSafetyUnavailableReason.BEYOND_FORECAST_RANGE);
        assertThat(placeWalkSafetyQueryPort.askedAt).containsExactly(DAY_1.plusDays(4).atTime(14, 0));
    }

    @Test
    @DisplayName("못 낸 줄도 장소를 들고 있다 — 화면은 그 줄에서 장소 위험도 API 를 직접 불러 다시 시도한다")
    void unavailableRowsKeepPlaceId() {
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            placeItem(1001L, 1, 1, PLACE_ID, null),
            walkItem(1002L, 1, 2, LocalTime.of(9, 0)));
        placeWalkSafetyQueryPort.unavailable = true;

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(info.items())
            .extracting(PlanItemWalkSafetyInfo::unavailableReason, PlanItemWalkSafetyInfo::placeId)
            .containsExactly(
                tuple(PlanItemWalkSafetyUnavailableReason.LOOKUP_FAILED, PLACE_ID),
                tuple(PlanItemWalkSafetyUnavailableReason.NO_START_TIME, PLACE_ID),
                // 올레 코스의 targetId 는 walk_course.id 라 장소로 내보내면 화면이 남의 아이디를 연다.
                tuple(PlanItemWalkSafetyUnavailableReason.NOT_PLACE_TARGET, null));
        // placeTitle 은 원천이 확인해 준 이름이라 비운다 — 일정에 적힌 이름은 title 로 이미 내려간다.
        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::placeTitle).containsOnlyNulls();
    }

    @Test
    @DisplayName("지난 날짜 줄도 장소를 들고 있다 — 다만 올레 코스는 장소가 아니라 그 줄만 비운다")
    void pastDateRowsKeepPlaceIdExceptWalkCourse() {
        LocalDate yesterday = DAY_1.minusDays(1);
        planItemRepositoryPort.items = List.of(
            placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)),
            walkItem(1001L, 1, 1, LocalTime.of(9, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(yesterday, yesterday), List.of(MONGSIL));

        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::unavailableReason)
            .containsOnly(PlanItemWalkSafetyUnavailableReason.PAST_DATE);
        assertThat(info.items()).extracting(PlanItemWalkSafetyInfo::placeId)
            .containsExactly(PLACE_ID, null);
    }

    @Test
    @DisplayName("지평 안인데 그 시각 예보만 없으면 NO_FORECAST_AT_TIME 이다 — 물어본 줄이라 등급·장소·기준 반려견이 함께 남는다")
    void unknownAnswerBecomesNoForecastAtTime() {
        placeWalkSafetyQueryPort.level = WalkSafetyLevel.UNKNOWN;
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(only(info).unavailableReason())
            .isEqualTo(PlanItemWalkSafetyUnavailableReason.NO_FORECAST_AT_TIME);
        // UNKNOWN 은 부재가 아니라 tour-service 가 실제로 답한 값이라 버리지 않는다 — 이 사유만
        // 사유 코드와 등급이 함께 온다. (화면은 사유 문장을 쓰므로 등급을 버려도 깨지지는 않는다.)
        assertThat(only(info).levelCode()).isEqualTo(WalkSafetyLevel.UNKNOWN.name());
        assertThat(only(info).levelDescription()).isEqualTo(WalkSafetyLevel.UNKNOWN.getDescription());
        // unavailable(...) 팩토리를 타지 않는다 — 그것은 "묻지 못한" 줄이 쓰는 것이라 아래를 버린다.
        assertThat(only(info).placeTitle()).isEqualTo("협재해수욕장");
        assertThat(only(info).basisPetId()).isEqualTo(MONGSIL);
        assertThat(only(info).targetDateTime()).isEqualTo(DAY_1.atTime(14, 0));
        // 문서가 약속한 예외의 마지막 칸이다 — 물어본 줄이라 null 이 아니다.
        assertThat(only(info).petConditionApplied()).isTrue();
    }

    @Test
    @DisplayName("지평 밖 날짜는 여전히 BEYOND_FORECAST_RANGE 다 — 묻지 않으므로 NO_FORECAST_AT_TIME 과 섞이지 않는다")
    void beyondForecastRangeDoesNotBecomeNoForecastAtTime() {
        // 물어봤다면 UNKNOWN 이 돌아올 스텁이다. 그래도 이 줄은 원격까지 가지 않아야 한다 —
        // 날짜만으로 갈리는 사유라 화면이 일자 단위로 접어 낼 수 있어야 하기 때문이다.
        placeWalkSafetyQueryPort.level = WalkSafetyLevel.UNKNOWN;
        planItemRepositoryPort.items = List.of(placeItem(1000L, 6, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1.plusDays(5)), List.of(MONGSIL));

        assertThat(only(info).unavailableReason())
            .isEqualTo(PlanItemWalkSafetyUnavailableReason.BEYOND_FORECAST_RANGE);
        assertThat(placeWalkSafetyQueryPort.calls).isZero();
        assertThat(only(info).levelCode()).isNull();
    }

    @Test
    @DisplayName("판정한 항목은 tour 가 준 petConditionApplied 를 그대로 든다 — false 는 '일반 조건으로 판정함' 이다")
    void assessedItemCarriesPetConditionApplied() {
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));

        placeWalkSafetyQueryPort.petConditionApplied = true;
        assertThat(only(processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL))).petConditionApplied())
            .isTrue();

        placeWalkSafetyQueryPort.petConditionApplied = false;
        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));
        assertThat(only(info).unavailableReason()).isNull();
        assertThat(only(info).petConditionApplied()).isFalse();
    }

    @Test
    @DisplayName("판정을 못 낸 항목의 petConditionApplied 는 null 이다 — 묻지 않았으므로 false 가 아니다")
    void unavailableItemHasNullPetConditionApplied() {
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, null));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));

        assertThat(only(info).unavailableReason()).isEqualTo(PlanItemWalkSafetyUnavailableReason.NO_START_TIME);
        // false 로 접으면 하지 않은 판정을 "반려견 특성 없이 했다" 고 말하게 된다.
        assertThat(only(info).petConditionApplied()).isNull();
    }

    /**
     * 아래 둘은 <b>일부러 계층을 가로지른다</b> — Processor 테스트인데 Presenter 를 직접 태워
     * 응답 DTO 까지 단언한다. 이 저장소 관례는 Presenter 검증을 {@code *PresenterTest} 로 분리하는
     * 것이지만, 여기서 막으려는 결함이 <b>계층 사이에서 값이 사라지는 것</b>이라 나누면 방어가
     * 사라진다.
     *
     * <p>#717 이 고친 버그가 정확히 그 모양이었다 — Feign DTO 에 칸이 없어
     * {@code @JsonIgnoreProperties(ignoreUnknown = true)} 가 {@code scoreDescription} 을 조용히
     * 버렸는데, <b>각 계층의 테스트는 전부 초록이었다.</b> 계층마다 자기 입력을 자기가 만들어
     * 넣으면 배선이 끊긴 것을 아무도 보지 못한다.
     *
     * <p><b>그러니 {@code PlanWalkSafetyPresenterTest} 로 옮기지 마라.</b> 옮기는 순간 이 회귀
     * 방어가 없어진다. 옮기고 싶다면 어댑터 역직렬화부터 응답까지를 덮는 다른 테스트를 먼저
     * 세워야 한다 (#759).
     */
    @Test
    @DisplayName("등급 scoreDescription 이 응답까지 내려간다 — Feign DTO 가 받지 않아 조용히 버려지던 값이다 (#717)")
    void levelScoreDescriptionReachesTheResponse() {
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));
        PlanWalkSafetyResponse response = new PlanWalkSafetyPresenter().toResponse(info);

        PlanItemWalkSafetyItem item = response.items().get(0);
        ScoreMetricMetadata level = item.walkSafetyLevel();
        assertThat(level.code()).isEqualTo(WalkSafetyLevel.DANGER.name());
        // Presenter 가 네 번째 칸을 null 로 두던 자리다. 원천이 주는 문장을 그대로 옮긴다.
        assertThat(level.scoreDescription()).isEqualTo(WalkSafetyLevel.DANGER.getScoreDescription());
        assertThat(item.petConditionApplied()).isTrue();
    }

    @Test
    @DisplayName("NO_FORECAST_AT_TIME 줄은 응답에서도 사유와 등급을 함께 든다 — 여섯 사유 중 이것만 walkSafetyLevel 이 null 이 아니다")
    void noForecastAtTimeRowKeepsLevelInTheResponse() {
        placeWalkSafetyQueryPort.level = WalkSafetyLevel.UNKNOWN;
        planItemRepositoryPort.items = List.of(placeItem(1000L, 1, 0, PLACE_ID, LocalTime.of(14, 0)));

        PlanWalkSafetyInfo info = processor.assess(1L, plan(DAY_1, DAY_1), List.of(MONGSIL));
        PlanWalkSafetyResponse response = new PlanWalkSafetyPresenter().toResponse(info);

        PlanItemWalkSafetyItem item = response.items().get(0);
        assertThat(item.unavailableReasonCode())
            .isEqualTo(PlanItemWalkSafetyUnavailableReason.NO_FORECAST_AT_TIME.name());
        assertThat(item.walkSafetyLevel()).isNotNull();
        assertThat(item.walkSafetyLevel().description()).isEqualTo(WalkSafetyLevel.UNKNOWN.getDescription());
    }

    private static PlanItemWalkSafetyInfo only(PlanWalkSafetyInfo info) {
        assertThat(info.items()).hasSize(1);
        return info.items().get(0);
    }

    private static Plan plan(LocalDate startDate, LocalDate endDate) {
        return plan(startDate, endDate, PlanStatus.DRAFT);
    }

    /** 완료된 일정만 완료 시점 스냅샷을 쓴다 (#629) — 그 분기를 고정하려고 상태를 따로 준다. */
    private static Plan completedPlan(LocalDate startDate, LocalDate endDate) {
        return plan(startDate, endDate, PlanStatus.COMPLETED);
    }

    private static Plan plan(LocalDate startDate, LocalDate endDate, PlanStatus status) {
        return Plan.builder()
            .id(PLAN_ID).memberId(1L).petId(MONGSIL).areaCode("39").title("몽실이와 제주")
            .startDate(startDate).endDate(endDate).status(status).build();
    }

    private static PlanItem placeItem(long id, int day, int sequence, long placeId, LocalTime startTime) {
        return PlanItem.builder()
            .id(id).planId(PLAN_ID).day(day).sequence(sequence)
            .itemType(PlanItemType.PLACE).targetId(placeId).title("협재해수욕장")
            .startTime(startTime)
            .build();
    }

    /** {@code targetId} 가 {@code walk_course.id} 인 항목. 장소 아이디가 아니다 (#89). */
    private static PlanItem walkItem(long id, int day, int sequence, LocalTime startTime) {
        return PlanItem.builder()
            .id(id).planId(PLAN_ID).day(day).sequence(sequence)
            .itemType(PlanItemType.WALK).targetId(WALK_COURSE_ID).title("올레 7코스")
            .startTime(startTime)
            .build();
    }

    // ── 스텁 ───────────────────────────────────────────────────────────────

    private static class StubPlaceWalkSafetyQueryPort implements PlaceWalkSafetyQueryPort {

        private int calls;
        private boolean unavailable;
        /** tour-service 가 답한 등급. 실제 enum 을 쓴다 — 문장까지 원천과 같은 값이어야 한다. */
        private WalkSafetyLevel level = WalkSafetyLevel.DANGER;
        private boolean petConditionApplied = true;
        private final List<LocalDateTime> askedAt = new ArrayList<>();
        private final List<PetConditionQueryResult> askedWith = new ArrayList<>();

        @Override
        public Optional<PlaceWalkSafetyQueryResult> findWalkSafety(
            long placeId, LocalDateTime targetDateTime, PetConditionQueryResult pet
        ) {
            calls += 1;
            askedAt.add(targetDateTime);
            askedWith.add(pet);
            if (unavailable) {
                return Optional.empty();
            }
            return Optional.of(PlaceWalkSafetyQueryResult.builder()
                .placeId(placeId).placeTitle("협재해수욕장").targetDateTime(targetDateTime)
                .levelCode(level.name()).levelName(level.getDisplayName())
                .levelDescription(level.getDescription())
                .levelScoreDescription(level.getScoreDescription())
                .estimatedPavementCelsius(58.0).feelsLikeCelsius(33.5).temperature(31.0)
                .saferWindowStart(LocalTime.of(18, 0)).saferWindowEnd(LocalTime.of(21, 0))
                .petConditionApplied(petConditionApplied)
                .build());
        }
    }

    private static class StubPetConditionQueryPort implements PetConditionQueryPort {

        private Map<Long, PetConditionQueryResult> conditions = Map.of();
        private int calls;

        @Override
        public Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds) {
            calls += 1;
            Map<Long, PetConditionQueryResult> found = new HashMap<>();
            petIds.forEach(petId -> {
                if (conditions.containsKey(petId)) {
                    found.put(petId, conditions.get(petId));
                }
            });
            return found;
        }

        @Override
        public Optional<Long> findRepresentativePetId(long memberId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Set<Long> findOwnedPetIds(long memberId, List<Long> petIds) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPlaceSuitabilityQueryPort implements PlaceSuitabilityQueryPort {

        private Function<PetConditionQueryResult, Integer> scoreOf = condition -> 60;
        private boolean unavailable;
        /** 그날 기준 반려견을 <b>언제·어느 날짜로</b> 구했는지. 게으른 조회를 고정하는 데 쓴다. */
        private final List<LocalDate> askedDates = new ArrayList<>();

        @Override
        public Optional<PlaceSuitabilityQueryResult> findSuitability(
            long placeId, LocalDate targetDate, PetConditionQueryResult pet
        ) {
            askedDates.add(targetDate);
            if (unavailable) {
                return Optional.empty();
            }
            Integer score = scoreOf.apply(pet);
            return Optional.of(PlaceSuitabilityQueryResult.builder()
                .placeId(placeId).placeTitle("협재해수욕장").targetDate(targetDate)
                .score(score)
                .levelCode(score >= 70 ? "HIGH" : "LOW")
                .levelName(score >= 70 ? "여행 적합" : "주의")
                .reasons(List.of())
                .indoorAlternatives(List.of())
                .build());
        }
    }

    private static class StubPlanItemRepositoryPort implements PlanItemRepositoryPort {

        private List<PlanItem> items = List.of();

        @Override
        public List<PlanItem> findByPlanId(long planId) {
            return items;
        }

        @Override
        public List<PlanItem> saveAll(List<PlanItem> items) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<PlanItem> findById(long planItemId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public PlanItem save(PlanItem item) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteByPlanIdAndDay(long planId, int day) {
            throw new UnsupportedOperationException();
        }
    }
}
