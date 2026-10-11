package com.hondigagae.domainlayer.planner.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.PackingListInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.PackingList;
import com.hondigagae.domainlayer.planner.domain.model.PackingList.PackingItem;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 같은 일정의 준비물 생성이 겹칠 때 (#1337).
 *
 * <p>dev 에서 버튼 더블클릭이 LLM 을 두 번 불렀다. 준비물 생성은 동기 호출이고 LLM 실효 동시성이 1이라,
 * 두 번째 호출은 게이트에서 첫 호출만큼 기다린 뒤 같은 일을 다시 하고 그동안 AI 일정 잡까지 줄을 세운다.
 *
 * <ul>
 *   <li><b>겹친 요청은 모델을 한 번만 부르고 같은 목록을 받는다</b></li>
 *   <li><b>실패도 함께 받고, 끝나면 슬롯이 풀린다</b> — 남으면 그 일정은 다시는 준비물을 못 만든다</li>
 *   <li><b>다른 일정은 서로 막지 않는다</b> — 키는 (회원, 일정) 이다</li>
 * </ul>
 */
class AiPackingSingleFlightTest {

    private static final long MEMBER_ID = 7L;
    private static final long PLAN_ID = 100L;

    @Test
    @DisplayName("같은 일정에 겹친 두 요청은 모델을 한 번만 부르고 같은 목록을 받는다")
    void joinsInFlightGeneration() throws Exception {
        BlockingLlm llm = new BlockingLlm();
        AiPackingProcessor processor = processor(llm);

        Call first = Call.start(() -> processor.generatePackingList(MEMBER_ID, PLAN_ID));
        llm.awaitEntered();
        Call second = Call.start(() -> processor.generatePackingList(MEMBER_ID, PLAN_ID));
        second.awaitParked();

        llm.release();

        assertThat(first.result()).isEqualTo(second.result());
        assertThat(first.result().items()).extracting(PackingListInfo.PackingItemInfo::name).containsExactly("배변봉투");
        assertThat(llm.calls.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("먼저 온 요청이 실패하면 겹친 요청도 같은 오류를 받고, 다음 요청은 새로 부른다")
    void sharesFailureAndReleasesSlot() throws Exception {
        BlockingLlm llm = new BlockingLlm();
        llm.failWith = new AiPlanException(AiPlanErrorCode.LLM_BUSY);
        AiPackingProcessor processor = processor(llm);

        Call first = Call.start(() -> processor.generatePackingList(MEMBER_ID, PLAN_ID));
        llm.awaitEntered();
        Call second = Call.start(() -> processor.generatePackingList(MEMBER_ID, PLAN_ID));
        second.awaitParked();

        llm.release();

        assertThat(first.failure()).isInstanceOf(AiPlanException.class);
        assertThat(((AiPlanException) second.failure()).getErrorCode()).isEqualTo(AiPlanErrorCode.LLM_BUSY);
        assertThat(llm.calls.get()).isEqualTo(1);

        // 실패한 생성의 슬롯이 남아 있으면 이 호출이 끝난 future 를 받아 같은 오류만 되풀이한다.
        llm.failWith = null;
        assertThat(processor.generatePackingList(MEMBER_ID, PLAN_ID).items()).hasSize(1);
        assertThat(llm.calls.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("일정 개요를 못 찾아 실패해도 슬롯이 풀린다")
    void releasesSlotWhenOutlineMissing() {
        BlockingLlm llm = new BlockingLlm();
        llm.release();
        AiPackingProcessor processor = processor(llm);

        assertThatThrownBy(() -> processor.generatePackingList(MEMBER_ID, 999L))
            .isInstanceOf(AiPlanException.class);
        assertThatThrownBy(() -> processor.generatePackingList(MEMBER_ID, 999L))
            .isInstanceOf(AiPlanException.class);
        assertThat(llm.calls.get()).isZero();
    }

    @Test
    @DisplayName("다른 일정의 생성은 서로 합치지 않는다")
    void differentPlansRunSeparately() throws Exception {
        BlockingLlm llm = new BlockingLlm();
        AiPackingProcessor processor = processor(llm);

        Call first = Call.start(() -> processor.generatePackingList(MEMBER_ID, PLAN_ID));
        llm.awaitEntered();
        Call other = Call.start(() -> processor.generatePackingList(MEMBER_ID, PLAN_ID + 1));
        llm.awaitCalls(2);

        llm.release();

        first.result();
        other.result();
        assertThat(llm.calls.get()).isEqualTo(2);
    }

    private static AiPackingProcessor processor(AiLlmPort llm) {
        return new AiPackingProcessor(
            (memberId, planId) -> planId == 999L ? Optional.empty() : Optional.of(outline(planId)),
            new NoPets(),
            areaCode -> List.of(),
            llm
        );
    }

    private static PlanOutline outline(long planId) {
        return PlanOutline.builder()
            .planId(planId)
            .areaCode("39")
            .startDate("2026-10-20")
            .endDate("2026-10-21")
            .petIds(List.of())
            .days(List.of())
            .build();
    }

    /** 첫 호출이 들어온 것을 알리고, 풀어 줄 때까지 붙잡는다. */
    private static final class BlockingLlm implements AiLlmPort {

        private final AtomicInteger calls = new AtomicInteger();
        private final CountDownLatch entered = new CountDownLatch(1);
        private final CountDownLatch released = new CountDownLatch(1);
        private volatile RuntimeException failWith;

        @Override
        public AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query) {
            throw new UnsupportedOperationException();
        }

        @Override
        public PackingList generatePackingList(PackingChecklistQuery query) {
            calls.incrementAndGet();
            entered.countDown();
            try {
                if (!released.await(5, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("release() 가 불리지 않았다");
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(exception);
            }
            if (failWith != null) {
                throw failWith;
            }
            return PackingList.builder()
                .items(List.of(PackingItem.builder().category("위생").name("배변봉투").reason("이유").build()))
                .build();
        }

        void awaitEntered() throws InterruptedException {
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
        }

        void awaitCalls(int expected) throws InterruptedException {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (calls.get() < expected) {
                assertThat(System.nanoTime()).isLessThan(deadline);
                Thread.sleep(5);
            }
        }

        void release() {
            released.countDown();
        }
    }

    private static final class NoPets implements PetConditionQueryPort {

        @Override
        public List<PetCondition> findConditions(long memberId, List<Long> petIds) {
            return List.of();
        }

        @Override
        public Optional<PetCondition> findRepresentativeCondition(long memberId) {
            return Optional.empty();
        }
    }

    /** 별도 스레드에서 한 번 부르고 결과나 실패를 담는다. */
    private static final class Call {

        private final Thread thread;
        private final AtomicReference<PackingListInfo> result = new AtomicReference<>();
        private final AtomicReference<Throwable> failure = new AtomicReference<>();

        private Call(Supplier<PackingListInfo> body) {
            this.thread = new Thread(() -> {
                try {
                    result.set(body.get());
                } catch (Throwable throwable) {
                    failure.set(throwable);
                }
            });
        }

        static Call start(Supplier<PackingListInfo> body) {
            Call call = new Call(body);
            call.thread.start();
            return call;
        }

        /** 진행 중인 결과를 기다리며 멈출 때까지. 그 전에 풀면 겹침이 아니라 순차 호출을 시험하게 된다. */
        void awaitParked() throws InterruptedException {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (thread.getState() != Thread.State.WAITING && thread.getState() != Thread.State.TIMED_WAITING) {
                assertThat(System.nanoTime()).isLessThan(deadline);
                Thread.sleep(5);
            }
        }

        PackingListInfo result() throws InterruptedException {
            thread.join(TimeUnit.SECONDS.toMillis(10));
            assertThat(failure.get()).isNull();
            return result.get();
        }

        Throwable failure() throws InterruptedException {
            thread.join(TimeUnit.SECONDS.toMillis(10));
            assertThat(failure.get()).isNotNull();
            return failure.get();
        }
    }
}
