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
 * compose 의 {@code ${VAR:-}} 는 변수를 부재가 아니라 <b>빈 문자열</b>로 만들고, 빈 문자열은 바인딩에서
 * null 로 떨어진다(#378 의 CRITICAL). 자동 다운로드 스위치와 두 숫자가 그 값에서 기동을 깨뜨리지 않고
 * 기본값으로 접히는지 고정한다 - 켜진 채로 접히는 것이 이 스위치의 기본이다.
 */
class CultureFacilityPropertiesTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class))
        .withUserConfiguration(TestConfig.class);

    @Test
    @DisplayName("빈 문자열은 바인딩을 깨뜨리지 않고 기본값(켬·120s·1MB)으로 접힌다")
    void bindsEmptyValuesToDefaults() {
        contextRunner.withPropertyValues(
                "culture-facility.download-enabled=",
                "culture-facility.read-timeout-ms=",
                "culture-facility.min-content-length=")
            .run(context -> {
                assertThat(context).hasNotFailed();
                CultureFacilityProperties properties = context.getBean(CultureFacilityProperties.class);
                assertThat(properties.downloadEnabled()).isTrue();
                assertThat(properties.readTimeoutMs()).isEqualTo(120_000);
                assertThat(properties.minContentLength()).isEqualTo(1_048_576L);
            });
    }

    @Test
    @DisplayName("값을 주지 않아도 켜진 채로 기본값이 채워진다")
    void fillsDefaultsWhenAbsent() {
        contextRunner.run(context -> {
            CultureFacilityProperties properties = context.getBean(CultureFacilityProperties.class);
            assertThat(properties.downloadEnabled()).isTrue();
            assertThat(properties.filePath()).isEqualTo("data/pet_culture.csv");
            assertThat(properties.baseUrl()).isEqualTo("https://www.data.go.kr");
            assertThat(properties.datasetId()).isEqualTo("15111389");
            assertThat(properties.downloadDir()).isNull();
        });
    }

    @Test
    @DisplayName("false 를 명시하면 종전처럼 로컬 파일만 읽는 모드가 된다")
    void bindsExplicitFalse() {
        contextRunner.withPropertyValues("culture-facility.download-enabled=false")
            .run(context -> assertThat(context.getBean(CultureFacilityProperties.class).downloadEnabled()).isFalse());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(CultureFacilityProperties.class)
    static class TestConfig {
    }
}
