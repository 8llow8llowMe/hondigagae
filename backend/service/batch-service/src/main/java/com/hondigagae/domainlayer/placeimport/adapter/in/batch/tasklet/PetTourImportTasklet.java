package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PetTourImportUseCase;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.stereotype.Component;

/**
 * 반려동물 동반 조건(detailPetTour2) 적재 단계 (#877). 장소 적재 뒤에 돈다 —
 * place 테이블의 TourAPI 원천 행이 결합 대상이기 때문이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PetTourImportTasklet implements Tasklet {

    private static final String DEFAULT_AREA_CODE = "39"; // 제주

    private final PetTourImportUseCase petTourImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Map<String, Object> jobParameters = chunkContext.getStepContext().getJobParameters();

        Object areaCodeParameter = jobParameters.get("areaCode");
        String areaCode = areaCodeParameter == null || areaCodeParameter.toString().isBlank()
            ? DEFAULT_AREA_CODE
            : areaCodeParameter.toString();

        int upserted = petTourImportUseCase.importPetTourInfos(areaCode);
        log.info("petTourImportJob done. areaCode={}, upserted={}", areaCode, upserted);
        return RepeatStatus.FINISHED;
    }
}
