package com.hondigagae.domainlayer.insight.adapter.in.scheduler;

import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.service.processor.PlaceRecommendationPrewarmProcessor;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 장소 추천 예열 스케줄 (#1388). 단기예보 격자 캐시가 낡은 직후에 추천을 한 번 계산해 둔다.
 *
 * <p><b>시각을 어떻게 정했나.</b> 격자 캐시의 신선도 만료는 코드에서 이렇게 정해진다.
 * <ul>
 *   <li>{@code KmaBaseTime.nextAvailableAt} — 다음 발표 정각 H:00 + {@code kma-api.publish-delay-minutes}(기본 10)</li>
 *   <li>{@code WeatherForecastProcessor.withGrace} — 거기에 {@code kma-api.cache-grace-minutes}(기본 30)를 더한 것이 {@code freshUntil}</li>
 *   <li>캐시 어댑터는 {@code now.isAfter(freshUntil)} 일 때 낡았다고 본다</li>
 * </ul>
 * 그래서 만료는 발표시각 H ∈ {2, 5, 8, 11, 14, 17, 20, 23} 의 <b>H:40</b> 이고, 기본 cron 은 그 5분 뒤 <b>H:45</b> 다.
 * 만료 전에 돌면 격자가 전부 캐시 적중으로 끝나 아무것도 채우지 않는다. 5분은 인스턴스 시계 어긋남을 넘기는 여유이고,
 * 그 사이 들어온 첫 방문자는 예열 전처럼 원천을 부를 뿐이다.
 *
 * <p><b>설정과 묶여 있다.</b> {@code publish-delay-minutes} 나 {@code cache-grace-minutes} 를 바꾸면
 * {@code insight.recommendation.prewarm.cron} 도 같이 옮겨야 한다 — 기본값끼리의 정합은
 * {@code PlaceRecommendationPrewarmCronTest} 가 지킨다. 중기예보 캐시(06 · 18시 발표, 만료 07:20 · 19:20)는 이 시각에 맞추지
 * 않는다. 키가 둘뿐이라 다음 예열(08:45 · 20:45)까지 첫 방문자가 두 번 부르는 것으로 끝난다.
 *
 * <p>시간대는 Asia/Seoul 로 못박는다 — 기상청 발표시각이 한국 시각이다. 신선도 계산({@code LocalDateTime.now()})은 JVM 기본
 * 시간대를 쓰고, 배포 이미지가 그것을 {@code -Duser.timezone=$TIME_ZONE}(Asia/Seoul)으로 둔다. 둘이 어긋나면 예열보다
 * 발표 회차 계산이 먼저 틀어진다.
 *
 * <p><b>실패는 삼킨다.</b> 예열은 사용자 경로의 지연을 덜어 주는 장치일 뿐이라, 실패하면 다음 회차에 다시 하고 그 사이 첫 방문자가
 * 예열 전처럼 계산한다. 예외를 올리면 스케줄러 스레드 로그만 어지럽힌다.
 *
 * <p>local · dev 프로필에서는 {@code insight.recommendation.prewarm.enabled=false} 로 빈 자체를 만들지 않는다 — dev 와 prod 가
 * 같은 기상청 serviceKey 를 쓰므로 prod 에서만 돈다. 이 서비스에는 {@code @SpringBootTest} 가 없다. 추가하면 테스트 설정에서 끈다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "insight.recommendation.prewarm", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PlaceRecommendationPrewarmScheduler {

    /** 기본 cron — 단기예보 격자 캐시 만료(발표시각 H:40) 5분 뒤. 근거는 클래스 주석. application.yml 기본값과 같아야 한다. */
    public static final String DEFAULT_CRON = "0 45 2,5,8,11,14,17,20,23 * * *";

    public static final String ZONE = "Asia/Seoul";

    private final PlaceRecommendationPrewarmProcessor placeRecommendationPrewarmProcessor;

    @Scheduled(cron = "${insight.recommendation.prewarm.cron:" + DEFAULT_CRON + "}", zone = ZONE)
    public void prewarm() {
        long startedAt = System.nanoTime();
        try {
            Optional<PlaceRecommendationInfo> prewarmed = placeRecommendationPrewarmProcessor.prewarm();
            if (prewarmed.isEmpty()) {
                log.info("Place recommendation prewarm skipped, lock held elsewhere");
                return;
            }
            PlaceRecommendationInfo info = prewarmed.get();
            // 격자 · 실패 수는 계산 쪽 요약 로그(Place recommendation computed ... weatherKeys=)가 함께 남긴다.
            log.info("Place recommendation prewarm done elapsedMs={} date={} places={} warning={}",
                elapsedMs(startedAt), info.targetDate(), info.places().size(), info.weatherWarning() != null);
        } catch (RuntimeException exception) {
            log.warn("Place recommendation prewarm failed elapsedMs={} reason={}", elapsedMs(startedAt), exception.getMessage(), exception);
        }
    }

    private static long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000L;
    }
}
