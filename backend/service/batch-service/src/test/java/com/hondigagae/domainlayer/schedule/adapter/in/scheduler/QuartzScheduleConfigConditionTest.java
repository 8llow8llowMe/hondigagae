package com.hondigagae.domainlayer.schedule.adapter.in.scheduler;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.global.properties.BatchScheduleProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.quartz.JobDetail;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * 이 조건은 두 가지 사고를 막는다 — 개발자 노트북·CI 가 새벽에 실제 적재를 시작하는 것과,
 * {@code docker exec} 로 잡 하나만 돌리려 띄운 두 번째 JVM 이 또 다른 잡을 띄우는 것.
 * 조건이 컴파일로 검증되지 않으므로 스위치 조합을 직접 돌려 본다. <b>불리언이 아닌 값</b>도
 * 조합에 넣는다 — 배포에서 실제로 들어올 수 있고, 그때 기동이 죽으면 안 된다.
 *
 * <p>{@code QuartzAutoConfiguration} 은 일부러 넣지 않는다. 실제 스케줄러를 띄우면 테스트가
 * 트리거 등록까지 하게 되는데, 여기서 보려는 것은 빈이 만들어지는지 여부뿐이다.
 */
class QuartzScheduleConfigConditionTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class))
        .withUserConfiguration(BatchSchedulePropertiesTestConfig.class, QuartzScheduleConfig.class);

    @Test
    @DisplayName("스케줄이 켜져 있고 수동 실행 JVM 이 아니면 세 잡의 JobDetail 이 등록된다")
    void registersJobDetailsWhenScheduleEnabled() {
        contextRunner.withPropertyValues("batch.schedule.enabled=true")
            .run(context -> assertThat(context.getBeansOfType(JobDetail.class))
                .containsOnlyKeys("placeDataPipelineJobDetail", "congestionImportJobDetail", "olleCourseImportJobDetail"));
    }

    @Test
    @DisplayName("수동 실행 JVM(spring.batch.job.enabled=true)에서는 스케줄이 켜져 있어도 등록하지 않는다")
    void skipsRegistrationOnManualLaunchJvm() {
        contextRunner.withPropertyValues("batch.schedule.enabled=true", "spring.batch.job.enabled=true")
            .run(context -> assertThat(context.getBeansOfType(JobDetail.class)).isEmpty());
    }

    @Test
    @DisplayName("스케줄이 꺼져 있으면 등록하지 않는다 (로컬·CI 기본값)")
    void skipsRegistrationWhenScheduleDisabled() {
        contextRunner.withPropertyValues("batch.schedule.enabled=false")
            .run(context -> assertThat(context.getBeansOfType(JobDetail.class)).isEmpty());
    }

    @Test
    @DisplayName("스위치를 아예 주지 않으면 꺼진 것으로 본다")
    void defaultsToDisabled() {
        contextRunner.run(context -> assertThat(context.getBeansOfType(JobDetail.class)).isEmpty());
    }

    @Test
    @DisplayName("빈 문자열이 들어와도 컨텍스트가 뜨고 꺼진 것으로 떨어진다")
    void treatsEmptyValueAsDisabledWithoutFailing() {
        // compose 의 `${BATCH_SCHEDULE_ENABLED:-}` 는 변수를 부재가 아니라 빈 문자열로 만든다.
        // 조건이 SpEL 이던 시절 이 값은 `" and not false"` 로 파싱돼 컨텍스트 refresh 를 통째로 깨뜨렸다.
        contextRunner.withPropertyValues("batch.schedule.enabled=")
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBeansOfType(JobDetail.class)).isEmpty();
            });
    }

    @Test
    @DisplayName("불리언이 아닌 값(yes)도 기동을 막지 않고 꺼진 것으로 떨어진다")
    void treatsNonBooleanValueAsDisabledWithoutFailing() {
        contextRunner.withPropertyValues("batch.schedule.enabled=yes")
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBeansOfType(JobDetail.class)).isEmpty();
            });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(BatchScheduleProperties.class)
    static class BatchSchedulePropertiesTestConfig {
    }
}
