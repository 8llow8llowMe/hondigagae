package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetConditionRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanWalkCourseQueryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

/**
 * 하루 교체가 일정 전체 항목 상한을 지키는가 (#1243).
 *
 * <p>하루 교체는 <b>다른 날 항목에 더해지는 경로</b>라 요청 {@code @Size} 만으로는 막히지 않는다 —
 * 다른 날 60 + 이 날 41 은 요청 하나로 보면 상한 안이다. 그래서 교체 뒤 일정 전체 수를 서비스가 센다.
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>교체될 그날의 옛 항목은 세지 않는다</b> — 통째로 바뀌는 자리라, 세면 꽉 찬 일정의 하루를 고치는
 *       것조차 막힌다
 *   <li><b>상한을 넘어도 늘지 않으면 받는다</b> — 상한 도입 전에 이미 넘은 옛 일정에서 줄이는 편집까지
 *       막으면 사용자가 그 일정을 상한 안으로 되돌릴 길이 없다
 *   <li><b>거절이면 아무것도 지우거나 쓰지 않는다</b> — 검사는 삭제 · 저장 앞이다
 * </ul>
 *
 * <p>포트는 Mockito 로 둔다. 이 테스트가 보는 것은 항목 조회 · 삭제 · 저장뿐이고, 다른 포트에 메서드가
 * 늘어날 때마다 여기 스텁을 고치지 않아도 되게 한다.
 */
class PlanItemLimitTest {

    private static final long PLAN_ID = 100L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Clock CLOCK = Clock.fixed(LocalDate.of(2026, 9, 28).atStartOfDay(SEOUL).toInstant(), SEOUL);

    private PlanRepositoryPort planRepositoryPort;
    private PlanItemRepositoryPort planItemRepositoryPort;
    private PlanCommandProcessor processor;

    @BeforeEach
    void setUp() {
        planRepositoryPort = mock(PlanRepositoryPort.class);
        planItemRepositoryPort = mock(PlanItemRepositoryPort.class);
        processor = new PlanCommandProcessor(
            planRepositoryPort, planItemRepositoryPort, mock(PlanPetRepositoryPort.class),
            mock(PlanPetConditionRepositoryPort.class), mock(PlaceVerifyQueryPort.class), mock(PlanWalkCourseQueryPort.class),
            mock(PetConditionQueryPort.class), new SnowflakeIdGenerator(1, 1), CLOCK);
    }

    @Test
    @DisplayName("다른 날 60 + 새 목록 40 = 100 이면 받는다 — 상한은 '넘으면' 거절이다")
    void acceptsReplaceReachingExactlyTheLimit() {
        storedItems(0, 60);

        processor.replaceDayItems(plan(), 1, commands(40));

        verify(planItemRepositoryPort).deleteByPlanIdAndDay(PLAN_ID, 1);
        verify(planItemRepositoryPort).saveAll(argThat(saving -> saving.size() == 40));
    }

    @Test
    @DisplayName("다른 날 60 + 새 목록 41 = 101 이면 400 PLAN_028 이고, 지우지도 쓰지도 않는다")
    void rejectsReplaceExceedingTheLimit() {
        storedItems(0, 60);

        assertThatThrownBy(() -> processor.replaceDayItems(plan(), 1, commands(41)))
            .isInstanceOf(PlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", PlanErrorCode.PLAN_ITEM_LIMIT_EXCEEDED)
            .hasMessage("일정에는 항목을 최대 100개까지 담을 수 있습니다.");

        verify(planItemRepositoryPort, never()).deleteByPlanIdAndDay(anyLong(), anyInt());
        verify(planItemRepositoryPort, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("교체될 그날의 옛 항목은 세지 않는다 — 꽉 찬 일정(50 + 50)의 하루를 같은 수로 고칠 수 있다")
    void doesNotCountTheReplacedDay() {
        storedItems(50, 50);

        assertThatCode(() -> processor.replaceDayItems(plan(), 1, commands(50))).doesNotThrowAnyException();

        verify(planItemRepositoryPort).saveAll(argThat(saving -> saving.size() == 50));
    }

    @Test
    @DisplayName("상한 전에 이미 넘은 옛 일정(120)에서 줄이는 교체(→115)는 받는다")
    void acceptsShrinkingAnOverLimitLegacyPlan() {
        storedItems(60, 60);

        assertThatCode(() -> processor.replaceDayItems(plan(), 1, commands(55))).doesNotThrowAnyException();

        verify(planItemRepositoryPort).saveAll(argThat(saving -> saving.size() == 55));
    }

    @Test
    @DisplayName("옛 일정(120)에서 수를 그대로 두는 교체도 받는다 — 순서 · 메모만 고치는 편집이다")
    void acceptsKeepingTheCountOfAnOverLimitLegacyPlan() {
        storedItems(60, 60);

        assertThatCode(() -> processor.replaceDayItems(plan(), 1, commands(60))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("옛 일정(120)에서 늘리는 교체(→121)는 400 PLAN_028 이다")
    void rejectsGrowingAnOverLimitLegacyPlan() {
        storedItems(60, 60);

        assertThatThrownBy(() -> processor.replaceDayItems(plan(), 1, commands(61)))
            .isInstanceOf(PlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", PlanErrorCode.PLAN_ITEM_LIMIT_EXCEEDED);

        verify(planItemRepositoryPort, never()).deleteByPlanIdAndDay(anyLong(), anyInt());
        verify(planItemRepositoryPort, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("세는 데 항목 조회는 한 번이다 — 날마다 따로 묻지 않는다")
    void countsWithOneLookup() {
        storedItems(10, 10, 10);

        processor.replaceDayItems(plan(), 2, commands(5));

        verify(planItemRepositoryPort, times(1)).findByPlanId(PLAN_ID);
    }

    @Test
    @DisplayName("일정 행을 세는 조회보다 먼저 잠근다 — 다른 날 동시 교체가 옛 값을 함께 세어 상한을 넘기지 않게")
    void locksPlanBeforeCounting() {
        storedItems(60, 0, 0);

        processor.replaceDayItems(plan(), 2, commands(40));

        InOrder order = inOrder(planRepositoryPort, planItemRepositoryPort);
        order.verify(planRepositoryPort).findActiveByIdForUpdate(PLAN_ID);
        order.verify(planItemRepositoryPort).findByPlanId(PLAN_ID);
        order.verify(planItemRepositoryPort).deleteByPlanIdAndDay(PLAN_ID, 2);
    }

    @Test
    @DisplayName("범위 밖 일차는 항목을 세기 전에 PLAN_002 다 — 순서가 바뀌어 헛된 조회를 하지 않는다")
    void rejectsOutOfRangeDayBeforeCounting() {
        assertThatThrownBy(() -> processor.replaceDayItems(plan(), 4, commands(1)))
            .isInstanceOf(PlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", PlanErrorCode.PLAN_DAY_OUT_OF_RANGE);

        verify(planItemRepositoryPort, never()).findByPlanId(anyLong());
    }

    @Test
    @DisplayName("상한 판정 규칙 — 상한 안이거나 늘지 않으면 받는다")
    void domainRule() {
        assertThat(Plan.acceptsItemCount(0, Plan.MAX_ITEMS)).isTrue();
        assertThat(Plan.acceptsItemCount(0, Plan.MAX_ITEMS + 1)).isFalse();
        assertThat(Plan.acceptsItemCount(120, 115)).isTrue();
        assertThat(Plan.acceptsItemCount(120, 120)).isTrue();
        assertThat(Plan.acceptsItemCount(120, 121)).isFalse();
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    /** 3일짜리 일정(2026-09-12~14). */
    private static Plan plan() {
        return Plan.builder()
            .id(PLAN_ID)
            .memberId(1L)
            .petId(7L)
            .areaCode("39")
            .title("몽실이와 제주")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .status(PlanStatus.DRAFT)
            .deleted(false)
            .build();
    }

    /** 저장돼 있는 항목. {@code countPerDay[i]} 가 {@code i + 1} 일차의 항목 수다. */
    private void storedItems(int... countPerDay) {
        List<PlanItem> all = new ArrayList<>();
        for (int index = 0; index < countPerDay.length; index++) {
            all.addAll(items(index + 1, countPerDay[index]));
        }
        when(planItemRepositoryPort.findByPlanId(eq(PLAN_ID))).thenReturn(all);
    }

    /** {@code day} 일차에 저장돼 있는 항목 {@code count} 개. 아이디는 일차마다 겹치지 않게 띄운다. */
    private static List<PlanItem> items(int day, int count) {
        return IntStream.range(0, count)
            .mapToObj(sequence -> PlanItem.builder()
                .id(day * 1_000L + sequence)
                .planId(PLAN_ID)
                .day(day)
                .sequence(sequence)
                .itemType(PlanItemType.PLACE)
                .title("항목 " + day + "-" + sequence)
                .build())
            .toList();
    }

    /** 교체 요청의 항목 {@code count} 개. 일차는 경로 값으로 덮어쓰므로 비워 둔다. */
    private static List<PlanItemCommand> commands(int count) {
        return IntStream.range(0, count)
            .mapToObj(sequence -> PlanItemCommand.builder()
                .sequence(sequence)
                .itemType(PlanItemType.PLACE)
                .title("새 항목 " + sequence)
                .build())
            .toList();
    }
}
