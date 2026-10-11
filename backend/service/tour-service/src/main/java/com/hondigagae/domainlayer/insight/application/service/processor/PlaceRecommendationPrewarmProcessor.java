package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationQuery;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceRecommendationPrewarmLockPort;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 장소 추천 예열 (#1388) — 단기예보 격자 캐시가 낡은 직후 서버가 먼저 추천을 계산해, 날씨 격자 캐시와 기본 조건 결과 캐시를
 * 채운다. 그 회차의 첫 홈 방문자가 기상청 왕복(dev 실측 키 53개 · 5.9초)을 떠안지 않게 하는 것이 목적이다.
 *
 * <p><b>사용자 요청과 같은 경로를 탄다</b>({@link PlaceRecommendationProcessor#recommend}). 따로 격자 목록을 돌면 후보 · 격자
 * 규칙이 둘로 갈라지고, 기본 조건 결과 캐시도 채우지 못한다. 다른 점은 결과 캐시를 읽지 않는다는 것 하나다
 * ({@link PlaceRecommendationQuery#prewarmToday()}).
 *
 * <p>트랜잭션을 걸지 않는다 — {@link PlaceRecommendationProcessor} 와 같은 이유(기상청 호출이 섞인다).
 */
@Component
@RequiredArgsConstructor
public class PlaceRecommendationPrewarmProcessor {

    /**
     * 작업 잠금 수명. 인스턴스 사이 cron 어긋남 · 계산 시간(실측 수 초)보다 길고, 발표 간격(3시간)보다 훨씬 짧으면 된다.
     * 해제하지 않으므로 다음 회차 전에 반드시 풀려야 한다.
     */
    static final Duration LOCK_TTL = Duration.ofMinutes(5);

    private final PlaceRecommendationPrewarmLockPort placeRecommendationPrewarmLockPort;
    private final PlaceRecommendationProcessor placeRecommendationProcessor;

    /**
     * @return 이번 인스턴스가 계산했으면 그 결과, 다른 인스턴스가 이미 잡은 회차(또는 Redis 장애)면 비어 있음
     */
    public Optional<PlaceRecommendationInfo> prewarm() {
        if (!placeRecommendationPrewarmLockPort.tryAcquire(LOCK_TTL)) {
            return Optional.empty();
        }
        return Optional.of(placeRecommendationProcessor.recommend(PlaceRecommendationQuery.prewarmToday()));
    }
}
