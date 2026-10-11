package com.hondigagae.domainlayer.insight.adapter.in.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.service.processor.PlaceRecommendationPrewarmProcessor;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/** 장소 추천 예열 스케줄 (#1388). */
class PlaceRecommendationPrewarmSchedulerTest {

    private final PlaceRecommendationPrewarmProcessor processor = mock(PlaceRecommendationPrewarmProcessor.class);
    private final PlaceRecommendationPrewarmScheduler scheduler = new PlaceRecommendationPrewarmScheduler(processor);

    @Test
    @DisplayName("예열을 한 번 부른다")
    void runsPrewarm() {
        when(processor.prewarm()).thenReturn(Optional.of(
            PlaceRecommendationInfo.builder().targetDate(LocalDate.now()).places(List.of()).build()));

        scheduler.prewarm();

        verify(processor).prewarm();
    }

    @Test
    @DisplayName("다른 인스턴스가 회차를 잡았으면(빈 결과) 조용히 건너뛴다")
    void skipsWhenLockHeldElsewhere() {
        when(processor.prewarm()).thenReturn(Optional.empty());

        assertThatCode(scheduler::prewarm).doesNotThrowAnyException();
        verify(processor).prewarm();
    }

    @Test
    @DisplayName("예열이 실패해도 예외를 올리지 않는다 — 다음 회차에 다시 한다")
    void swallowsFailure() {
        when(processor.prewarm()).thenThrow(new InsightException(InsightErrorCode.WEATHER_SERVICE_KEY_MISSING));

        assertThatCode(scheduler::prewarm).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("예상 밖 런타임 예외도 삼킨다")
    void swallowsUnexpectedFailure() {
        when(processor.prewarm()).thenThrow(new IllegalStateException("redis down"));

        assertThatCode(scheduler::prewarm).doesNotThrowAnyException();
    }

    /**
     * 켜고 끄는 스위치는 빈 생성 조건이라 컴파일로 검증되지 않는다. 조합을 직접 돌려 본다. 로컬 프로필이 끄는 값과 같은 경로다.
     */
    @Nested
    @DisplayName("insight.recommendation.prewarm.enabled")
    class EnabledSwitch {

        private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withBean(PlaceRecommendationPrewarmProcessor.class, () -> processor)
            .withUserConfiguration(PlaceRecommendationPrewarmScheduler.class);

        @Test
        @DisplayName("false 면 스케줄 빈을 만들지 않는다 — 예열이 돌지 않는다")
        void disabled() {
            contextRunner.withPropertyValues("insight.recommendation.prewarm.enabled=false")
                .run(context -> assertThat(context).doesNotHaveBean(PlaceRecommendationPrewarmScheduler.class));
        }

        @Test
        @DisplayName("true 면 만든다")
        void enabled() {
            contextRunner.withPropertyValues("insight.recommendation.prewarm.enabled=true")
                .run(context -> assertThat(context).hasSingleBean(PlaceRecommendationPrewarmScheduler.class));
        }

        @Test
        @DisplayName("값이 없으면 켜진 것으로 본다(배포 기본)")
        void defaultsToEnabled() {
            contextRunner.run(context -> assertThat(context).hasSingleBean(PlaceRecommendationPrewarmScheduler.class));
        }
    }
}
