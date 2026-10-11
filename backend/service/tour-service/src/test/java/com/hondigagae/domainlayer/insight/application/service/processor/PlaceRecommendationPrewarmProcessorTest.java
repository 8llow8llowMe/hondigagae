package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationQuery;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceRecommendationPrewarmLockPort;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 장소 추천 예열 (#1388). */
class PlaceRecommendationPrewarmProcessorTest {

    private final PlaceRecommendationPrewarmLockPort lockPort = mock(PlaceRecommendationPrewarmLockPort.class);
    private final PlaceRecommendationProcessor recommendationProcessor = mock(PlaceRecommendationProcessor.class);
    private final PlaceRecommendationPrewarmProcessor processor = new PlaceRecommendationPrewarmProcessor(lockPort, recommendationProcessor);

    @Test
    @DisplayName("잠금을 못 잡으면 계산하지 않는다 — 다른 인스턴스가 이번 회차를 맡았다")
    void skipsWhenLockNotAcquired() {
        when(lockPort.tryAcquire(any())).thenReturn(false);

        Optional<PlaceRecommendationInfo> result = processor.prewarm();

        assertThat(result).isEmpty();
        verify(recommendationProcessor, never()).recommend(any());
    }

    @Test
    @DisplayName("잠금을 잡으면 오늘 · 반려견 조건 없음 · 기본 개수로, 결과 캐시를 읽지 않고 계산한다")
    void recommendsTodayWithDefaultConditionBypassingCacheRead() {
        PlaceRecommendationInfo info = PlaceRecommendationInfo.builder().targetDate(LocalDate.now()).places(List.of()).build();
        when(lockPort.tryAcquire(any())).thenReturn(true);
        when(recommendationProcessor.recommend(any())).thenReturn(info);

        Optional<PlaceRecommendationInfo> result = processor.prewarm();

        assertThat(result).containsSame(info);
        ArgumentCaptor<PlaceRecommendationQuery> captor = ArgumentCaptor.forClass(PlaceRecommendationQuery.class);
        verify(recommendationProcessor).recommend(captor.capture());
        PlaceRecommendationQuery query = captor.getValue();
        assertThat(query.resolvedDate()).isEqualTo(LocalDate.now());
        assertThat(query.petCondition()).isEqualTo(PetCondition.unspecified());
        assertThat(query.petCondition().isSpecified()).isFalse();
        assertThat(query.limit()).isEqualTo(PlaceRecommendationQuery.DEFAULT_LIMIT).isEqualTo(3);
        assertThat(query.refreshCache()).isTrue();
    }

    @Test
    @DisplayName("잠금 수명은 발표 간격(3시간)보다 훨씬 짧다 — 해제하지 않으므로 다음 회차 전에 풀려야 한다")
    void lockTtlExpiresBeforeNextRun() {
        when(lockPort.tryAcquire(any())).thenReturn(false);

        processor.prewarm();

        verify(lockPort).tryAcquire(Duration.ofMinutes(5));
        assertThat(PlaceRecommendationPrewarmProcessor.LOCK_TTL).isLessThan(Duration.ofHours(3));
    }
}
