package com.hondigagae.domainlayer.plan.adapter.in.scheduler;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanCompanionReconcileProcessor;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.LongStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;

/**
 * 동행견 대사 회차 운영 (#720).
 *
 * <p>고정하는 것은 셋이다 — 커서가 앞으로만 가는가, 원천 장애 때 <b>회차를 멈추는가</b>,
 * 마른 페이지에서 헛조회를 하지 않는가. 정리 규칙은 프로세서 테스트가 본다.
 */
class PlanCompanionReconcileSchedulerTest {

    /** 스케줄러의 페이지 크기. 한 페이지가 꽉 차야 다음 페이지를 본다는 규칙을 테스트가 그대로 쓴다. */
    private static final int PAGE_SIZE = 200;

    /** 스케줄러의 회차 페이지 상한. 값이 바뀌면 이 테스트가 먼저 깨져 상한이 살아 있음을 알린다. */
    private static final int MAX_PAGES_PER_RUN = 500;

    @Test
    @DisplayName("페이지가 꽉 차면 커서를 밀어 다음 페이지를 이어 훑는다")
    void walksPagesWithACursor() {
        RecordingProcessor processor = new RecordingProcessor(
            LongStream.rangeClosed(1, PAGE_SIZE).boxed().toList(),
            List.of(PAGE_SIZE + 1L));

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        assertThat(processor.cursors).containsExactly(0L, (long) PAGE_SIZE);
        assertThat(processor.reconciled).hasSize(PAGE_SIZE + 1);
    }

    @Test
    @DisplayName("페이지가 덜 찼으면 한 번 더 조회하지 않는다 — 대상이 마른 것이다")
    void stopsWhenAPageIsNotFull() {
        RecordingProcessor processor = new RecordingProcessor(List.of(1L, 2L));

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        assertThat(processor.cursors).containsExactly(0L);
        assertThat(processor.reconciled).containsExactly(1L, 2L);
    }

    @Test
    @DisplayName("회원 하나가 실패해도 건너뛰고 계속한다 — 커서가 매 회차 0부터라 여기서 멈추면 뒤 회원이 영영 밀린다")
    void skipsAFailingMemberAndKeepsGoing() {
        RecordingProcessor processor = new RecordingProcessor(List.of(1L, 2L, 3L));
        processor.failingMemberIds = Set.of(2L);

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        assertThat(processor.reconciled).containsExactly(1L, 2L, 3L);
    }

    @Test
    @DisplayName("연속 실패가 상한에 닿으면 회차를 중단한다 — auth 전면 장애는 첫 다섯에서 바로 잡힌다")
    void abortsAfterConsecutiveFailures() {
        RecordingProcessor processor = new RecordingProcessor(List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L));
        processor.failingMemberIds = Set.of(1L, 2L, 3L, 4L, 5L, 6L, 7L);

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        assertThat(processor.reconciled).containsExactly(1L, 2L, 3L, 4L, 5L);
        assertThat(processor.cursors).containsExactly(0L);
    }

    @Test
    @DisplayName("성공이 한 번 끼면 연속 실패 수가 풀린다 — 드문 실패가 쌓여 회차를 멈추지 않는다")
    void resetsConsecutiveFailuresOnSuccess() {
        RecordingProcessor processor = new RecordingProcessor(List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L));
        processor.failingMemberIds = Set.of(1L, 2L, 3L, 4L, 6L, 7L, 8L, 9L);

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        // 5번에서 한 번 성공하며 카운터가 풀려 끝까지 간다.
        assertThat(processor.reconciled).containsExactly(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L);
    }

    @Test
    @DisplayName("회원 단위 DB 예외도 같은 실패 카운터에 들어간다 — 503 만 세면 다른 예외가 회차를 조용히 죽인다")
    void countsNonPlanExceptionsAsFailuresToo() {
        RecordingProcessor processor = new RecordingProcessor(List.of(1L, 2L, 3L));
        processor.failingMemberIds = Set.of(2L);
        processor.failWithDataAccessException = true;

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        assertThat(processor.reconciled).containsExactly(1L, 2L, 3L);
    }

    @Test
    @DisplayName("대상 회원이 없으면 아무것도 하지 않는다")
    void doesNothingWithoutTargets() {
        RecordingProcessor processor = new RecordingProcessor(List.of());

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        assertThat(processor.reconciled).isEmpty();
    }

    @Test
    @DisplayName("페이지가 계속 꽉 차도 회차 상한에서 멈춘다 — 새벽 배치가 끝없이 돌지 않는다")
    void stopsAtTheRunPageCap() {
        RecordingProcessor processor = RecordingProcessor.alwaysFullPages();

        new PlanCompanionReconcileScheduler(processor).reconcileCompanionPets();

        assertThat(processor.cursors).hasSize(MAX_PAGES_PER_RUN);
        // 커서가 계속 전진했다 = 같은 페이지를 반복해서 멈춘 것이 아니라 상한에 걸려 멈췄다.
        assertThat(processor.cursors.get(MAX_PAGES_PER_RUN - 1)).isEqualTo((long) (MAX_PAGES_PER_RUN - 1) * PAGE_SIZE);
    }

    /**
     * 페이지를 미리 정해 두고 커서와 처리 순서를 기록한다.
     *
     * <p>포트가 아니라 프로세서를 흉내 내는 이유는, 이 테스트가 보는 것이 <b>회차 운영</b>이라
     * 프로세서 안쪽(원천 조회·정리)을 통과시킬 필요가 없기 때문이다.
     */
    private static final class RecordingProcessor extends PlanCompanionReconcileProcessor {

        private final List<List<Long>> pages;
        private final List<Long> cursors = new ArrayList<>();
        private final List<Long> reconciled = new ArrayList<>();
        /** 켜면 페이지가 마르지 않는다 — 회차 상한이 실제로 루프를 끊는지 보는 용도다. */
        private final boolean alwaysFull;
        private Set<Long> failingMemberIds = Set.of();
        /** 켜면 503(PlanException) 대신 DB 예외로 실패한다 — 실패 카운터가 예외 종류를 가리지 않는지 본다. */
        private boolean failWithDataAccessException;
        private int pageIndex;

        @SafeVarargs
        private RecordingProcessor(List<Long>... pages) {
            super(null, null, null, null);
            this.pages = List.of(pages);
            this.alwaysFull = false;
        }

        private RecordingProcessor() {
            super(null, null, null, null);
            this.pages = List.of();
            this.alwaysFull = true;
        }

        private static RecordingProcessor alwaysFullPages() {
            return new RecordingProcessor();
        }

        @Override
        public List<Long> findMemberIdsToReconcile(long lastMemberId, int size) {
            cursors.add(lastMemberId);
            if (alwaysFull) {
                // 커서가 계속 전진하도록 lastMemberId 뒤의 아이디로 꽉 찬 페이지를 만든다.
                return LongStream.rangeClosed(lastMemberId + 1, lastMemberId + size).boxed().toList();
            }
            return pageIndex < pages.size() ? pages.get(pageIndex++) : List.of();
        }

        @Override
        public PlanCompanionReconcileCounts reconcileMember(long memberId) {
            reconciled.add(memberId);
            if (failingMemberIds.contains(memberId)) {
                if (failWithDataAccessException) {
                    throw new CannotAcquireLockException("lock wait timeout");
                }
                throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
            }
            return PlanCompanionReconcileCounts.NONE;
        }
    }
}
