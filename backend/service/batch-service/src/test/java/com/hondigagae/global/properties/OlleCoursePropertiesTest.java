package com.hondigagae.global.properties;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class OlleCoursePropertiesTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class))
        .withUserConfiguration(TestConfig.class);

    @Test
    @DisplayName("빈 문자열은 바인딩을 깨뜨리지 않고 기본값(켬·120s·200B)으로 접힌다")
    void bindsEmptyValuesToDefaults() {
        contextRunner.withPropertyValues(
                "olle-course.download-enabled=",
                "olle-course.read-timeout-ms=",
                "olle-course.min-content-length=")
            .run(context -> {
                assertThat(context).hasNotFailed();
                OlleCourseProperties properties = context.getBean(OlleCourseProperties.class);
                assertThat(properties.downloadEnabled()).isTrue();
                assertThat(properties.readTimeoutMs()).isEqualTo(120_000);
                assertThat(properties.minContentLength()).isEqualTo(200L);
            });
    }

    @Test
    @DisplayName("값을 주지 않아도 켜진 채로 기본값이 채워진다")
    void fillsDefaultsWhenAbsent() {
        contextRunner.run(context -> {
            OlleCourseProperties properties = context.getBean(OlleCourseProperties.class);
            assertThat(properties.downloadEnabled()).isTrue();
            assertThat(properties.filePath()).isEqualTo("data/olle_course.csv");
            assertThat(properties.baseUrl()).isEqualTo("https://www.data.go.kr");
            assertThat(properties.datasetId()).isEqualTo("15043496");
            assertThat(properties.downloadDir()).isNull();
        });
    }

    @Test
    @DisplayName("false 를 명시하면 종전처럼 로컬 파일만 읽는 모드가 된다")
    void bindsExplicitFalse() {
        contextRunner.withPropertyValues("olle-course.download-enabled=false")
            .run(context -> assertThat(context.getBean(OlleCourseProperties.class).downloadEnabled()).isFalse());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(OlleCourseProperties.class)
    static class TestConfig {
    }
}
