package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.adapter.in.scheduler.PlaceRecommendationPrewarmScheduler;
import java.io.IOException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertySourcesPropertyResolver;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.support.CronExpression;

/**
 * 예열 cron 기본값이 단기예보 격자 캐시의 신선도 만료 <b>직후</b>에 울리는지 (#1388).
 *
 * <p>만료 시각은 손으로 적지 않고 실제 계산 경로로 낸다 — 캐시에 넣을 때와 같은
 * {@link KmaBaseTime#latestAvailable} → {@link KmaBaseTime#nextAvailableAt} → {@code + cache-grace-minutes}
 * ({@code WeatherForecastProcessor.withGrace}). 지연 · 유예 값과 cron 은 <b>application.yml 의 기본값</b>을 읽는다(환경 변수는
 * 보지 않는다). 그래서 어느 한쪽 기본값만 바꾸면 이 테스트가 깨진다 — 그것이 이 테스트의 목적이다.
 *
 * <p>KmaBaseTime 이 어댑터 패키지 전용이라 테스트도 이 패키지에 둔다.
 */
class PlaceRecommendationPrewarmCronTest {

    /** 만료 뒤 이 안에 울려야 한다. 너무 늦으면 그 사이 첫 방문자가 콜드 비용을 떠안는다. */
    private static final Duration MAX_LAG = Duration.ofMinutes(10);

    private static PropertySourcesPropertyResolver ymlDefaults;

    @BeforeAll
    static void loadApplicationYml() throws IOException {
        MutablePropertySources sources = new MutablePropertySources();
        new YamlPropertySourceLoader().load("application.yml", new ClassPathResource("application.yml")).forEach(sources::addLast);
        ymlDefaults = new PropertySourcesPropertyResolver(sources);
    }

    @Test
    @DisplayName("application.yml 의 cron 기본값은 스케줄러 코드의 기본값과 같다")
    void ymlCronMatchesCodeDefault() {
        assertThat(ymlDefaults.getProperty("insight.recommendation.prewarm.cron"))
            .isEqualTo(PlaceRecommendationPrewarmScheduler.DEFAULT_CRON);
        assertThat(ymlDefaults.getProperty("insight.recommendation.prewarm.enabled", Boolean.class)).isTrue();
    }

    @Test
    @DisplayName("하루 8번, 매 격자 캐시 만료(발표시각 H:40)마다 그 뒤 10분 안에 한 번 울린다 — 만료 전에는 울리지 않는다")
    void firesShortlyAfterEveryShortTermExpiry() {
        int publishDelay = ymlDefaults.getRequiredProperty("kma-api.publish-delay-minutes", Integer.class);
        int grace = ymlDefaults.getRequiredProperty("kma-api.cache-grace-minutes", Integer.class);
        CronExpression cron = CronExpression.parse(PlaceRecommendationPrewarmScheduler.DEFAULT_CRON);
        LocalDate day = LocalDate.of(2026, 10, 11);

        // 하루 동안 어느 시각에 원천을 불러 캐시에 넣었든, 그 값이 낡는 시각을 전부 모은다(앞뒤 하루 여유).
        TreeSet<LocalDateTime> expiries = new TreeSet<>();
        for (LocalDateTime fetchedAt = day.minusDays(1).atStartOfDay(); fetchedAt.isBefore(day.plusDays(2).atStartOfDay());
            fetchedAt = fetchedAt.plusMinutes(1)) {
            KmaBaseTime base = KmaBaseTime.latestAvailable(fetchedAt, publishDelay);
            expiries.add(base.nextAvailableAt(publishDelay).plusMinutes(grace));
        }

        List<LocalDateTime> fires = new ArrayList<>();
        for (LocalDateTime fire = cron.next(day.atStartOfDay().minusNanos(1)); fire.isBefore(day.plusDays(1).atStartOfDay());
            fire = cron.next(fire)) {
            fires.add(fire);
        }

        assertThat(fires).hasSize(8);
        List<LocalDateTime> expiriesOfDay = expiries.subSet(day.atStartOfDay(), day.plusDays(1).atStartOfDay()).stream().toList();
        assertThat(expiriesOfDay).hasSize(8);
        for (LocalDateTime expiry : expiriesOfDay) {
            LocalDateTime nextFire = cron.next(expiry);
            // 신선도 판정이 now.isAfter(freshUntil) 라 만료 시각 정각에는 아직 신선하다 — 뒤여야 한다.
            assertThat(nextFire).as("expiry %s", expiry).isAfter(expiry);
            assertThat(Duration.between(expiry, nextFire)).as("expiry %s", expiry).isLessThanOrEqualTo(MAX_LAG);
        }
        for (LocalDateTime fire : fires) {
            // 울릴 때는 언제나 바로 앞 만료가 MAX_LAG 안에 있다 — 캐시가 신선한 한가운데서 헛돌지 않는다.
            LocalDateTime lastExpiry = expiries.lower(fire);
            assertThat(Duration.between(lastExpiry, fire)).as("fire %s", fire).isLessThanOrEqualTo(MAX_LAG);
        }
    }
}
