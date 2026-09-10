package com.hondigagae.global.properties;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * 배포에서 들어오는 값이 늘 불리언 리터럴은 아니다. compose 의 {@code ${BATCH_SCHEDULE_ENABLED:-}} 는
 * 변수를 부재가 아니라 <b>빈 문자열</b>로 만들고, 빈 문자열은 바인딩에서 null 로 떨어진다.
 * {@code enabled} 가 primitive 이던 시절 그 null 이 record 생성을 깨뜨려 배치 컨테이너가
 * crash-loop 에 빠졌다. 여기서 그 경로를 고정한다.
 */
class BatchSchedulePropertiesTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class))
        .withUserConfiguration(TestConfig.class);

    @Test
    @DisplayName("빈 문자열은 바인딩을 깨뜨리지 않고 false 로 접힌다")
    void bindsEmptyEnabledToFalse() {
        contextRunner.withPropertyValues("batch.schedule.enabled=")
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(BatchScheduleProperties.class).enabled()).isFalse();
            });
    }

    @Test
    @DisplayName("값을 주지 않아도 false 이고 나머지 기본값이 채워진다")
    void fillsDefaultsWhenAbsent() {
        contextRunner.run(context -> {
            BatchScheduleProperties properties = context.getBean(BatchScheduleProperties.class);
            assertThat(properties.enabled()).isFalse();
            assertThat(properties.timeZone()).isEqualTo("Asia/Seoul");
            assertThat(properties.placePipelineCron()).isEqualTo("0 0 3 ? * MON");
            assertThat(properties.congestionCron()).isEqualTo("0 0 6 * * ?");
            assertThat(properties.staleRunningAfter()).hasHours(6);
        });
    }

    @Test
    @DisplayName("true 만 켠 것으로 본다")
    void bindsExplicitTrue() {
        contextRunner.withPropertyValues("batch.schedule.enabled=true")
            .run(context -> assertThat(context.getBean(BatchScheduleProperties.class).enabled()).isTrue());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(BatchScheduleProperties.class)
    static class TestConfig {
    }
}
