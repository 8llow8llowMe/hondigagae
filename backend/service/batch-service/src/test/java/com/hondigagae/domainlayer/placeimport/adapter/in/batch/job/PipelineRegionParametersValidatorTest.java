package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.JobParametersInvalidException;

/**
 * 세 이름으로 흩어진 지역 파라미터가 한 지역을 가리키는지 고정한다.
 *
 * <p>어긋나면 어느 잡도 실패하지 않은 채 "부산을 적재하고 제주만 병합" 같은 결과가 나온다.
 * 조용히 틀리는 종류라 실행 전에 걸러야 한다.
 */
class PipelineRegionParametersValidatorTest {

    private final PipelineRegionParametersValidator validator = new PipelineRegionParametersValidator();

    @Test
    @DisplayName("파라미터를 하나도 주지 않으면 세 기본값(39·제주특별자치도·제주)이 맞아떨어져 통과한다")
    void passesWithDefaultsOnly() {
        assertThatCode(() -> validator.validate(new JobParameters())).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("빈 값(areaCode=)은 기본값으로 떨어져 통과한다 — 명령줄에서 값을 비운 것을 오타로 죽이지 않는다")
    void treatsBlankAsDefault() throws Exception {
        JobParameters parameters = new JobParametersBuilder()
            .addString("areaCode", "")
            .addString("sido", " ")
            .toJobParameters();

        validator.validate(parameters);
    }

    @Test
    @DisplayName("세 값을 모두 제주로 명시하면 통과한다")
    void passesWhenEveryParameterPointsAtJeju() {
        JobParameters parameters = new JobParametersBuilder()
            .addString("areaCode", "39")
            .addString("sido", "제주특별자치도")
            .addString("region", "제주")
            .toJobParameters();

        assertThatCode(() -> validator.validate(parameters)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("sido 만 서울이면 실패한다 — 문화시설만 다른 지역을 적재하게 된다")
    void failsWhenSidoPointsAtAnotherRegion() {
        JobParameters parameters = new JobParametersBuilder()
            .addString("sido", "서울특별시")
            .toJobParameters();

        assertThatThrownBy(() -> validator.validate(parameters))
            .isInstanceOf(JobParametersInvalidException.class)
            .hasMessageContaining("서울특별시");
    }

    @Test
    @DisplayName("region 만 부산이면 실패한다 — 매핑에 없는 지역은 환산 결과가 null 이라 불일치로 본다")
    void failsWhenRegionPointsAtAnotherRegion() {
        JobParameters parameters = new JobParametersBuilder()
            .addString("region", "부산")
            .toJobParameters();

        assertThatThrownBy(() -> validator.validate(parameters))
            .isInstanceOf(JobParametersInvalidException.class)
            .hasMessageContaining("부산");
    }

    @Test
    @DisplayName("areaCode 만 서울(1)이면 실패한다")
    void failsWhenAreaCodeDoesNotMatchNames() {
        JobParameters parameters = new JobParametersBuilder()
            .addString("areaCode", "1")
            .toJobParameters();

        assertThatThrownBy(() -> validator.validate(parameters))
            .isInstanceOf(JobParametersInvalidException.class)
            .hasMessageContaining("areaCode=1");
    }
}
