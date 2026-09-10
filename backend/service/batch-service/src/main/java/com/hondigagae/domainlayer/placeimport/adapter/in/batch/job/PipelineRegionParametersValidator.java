package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import org.springframework.batch.core.JobParameter;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersInvalidException;
import org.springframework.batch.core.JobParametersValidator;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * 파이프라인의 지역 파라미터 세 개가 같은 지역을 가리키는지 확인한다.
 *
 * <p>"적재 범위와 병합 범위는 한 값에서 나와야 한다" (docs/services/batch-service.md). 그런데 자식 잡마다
 * 지역을 받는 파라미터 이름이 다르다 — TourAPI 적재는 {@code areaCode=39}, 문화정보원은
 * {@code sido=제주특별자치도}, 식약처는 원천 표기 그대로 {@code region=제주} 다. 잡을 하나씩 돌릴 때는
 * 각자 자기 값만 쓰니 어긋날 여지가 없지만, <b>한 잡으로 묶는 순간 세 값이 한 실행 안에 공존하면서
 * 서로 다른 지역을 가리킬 수 있다.</b> 부산을 적재해 놓고 제주만 병합하는 조용한 어긋남이 그것이다.
 *
 * <p>그래서 실행 전에 세 값을 {@link RegionCodeMapping} 으로 같은 체계(관광 areaCode)로 환산해 비교한다.
 * 매핑에 없는 지역이면 환산 결과가 null 이고, 그것도 불일치로 본다 — 모르는 지역으로 적재를 시작하면
 * 0건을 받아 놓고 성공으로 끝난다.
 */
@Component
public class PipelineRegionParametersValidator implements JobParametersValidator {

    private static final String AREA_CODE_KEY = "areaCode";
    private static final String SIDO_KEY = "sido";
    private static final String REGION_KEY = "region";

    /** 자식 tasklet 들의 기본값과 같은 값을 쓴다 — 여기만 다르면 검증이 실제 실행과 어긋난다. */
    private static final String DEFAULT_AREA_CODE = "39";
    private static final String DEFAULT_SIDO = "제주특별자치도";
    private static final String DEFAULT_REGION = "제주";

    @Override
    public void validate(@Nullable JobParameters parameters) throws JobParametersInvalidException {
        String areaCode = stringParameter(parameters, AREA_CODE_KEY, DEFAULT_AREA_CODE);
        String sido = stringParameter(parameters, SIDO_KEY, DEFAULT_SIDO);
        String region = stringParameter(parameters, REGION_KEY, DEFAULT_REGION);

        String areaCodeOfSido = RegionCodeMapping.toAreaCode(sido);
        String areaCodeOfRegion = RegionCodeMapping.toAreaCode(RegionCodeMapping.toSidoName(region));

        if (!areaCode.equals(areaCodeOfSido) || !areaCode.equals(areaCodeOfRegion)) {
            throw new JobParametersInvalidException(
                "파이프라인의 지역 파라미터가 한 지역을 가리키지 않는다. "
                    + "areaCode=%s, sido=%s(areaCode=%s), region=%s(areaCode=%s)"
                    .formatted(areaCode, sido, areaCodeOfSido, region, areaCodeOfRegion)
            );
        }
    }

    private String stringParameter(@Nullable JobParameters parameters, String key, String defaultValue) {
        JobParameter<?> parameter = parameters == null ? null : parameters.getParameter(key);
        if (parameter == null || parameter.getValue() == null || parameter.getValue().toString().isBlank()) {
            return defaultValue;
        }
        return parameter.getValue().toString().trim();
    }
}
