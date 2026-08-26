package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class CultureFacilityImportTasklet implements Tasklet {

    private static final String DEFAULT_SIDO = "제주특별자치도";

    private final CultureFacilityImportUseCase cultureFacilityImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Map<String, Object> jobParameters = chunkContext.getStepContext().getJobParameters();

        Object sidoParameter = jobParameters.get("sido");
        String sido = sidoParameter == null || sidoParameter.toString().isBlank()
            ? DEFAULT_SIDO
            : sidoParameter.toString();

        int imported = cultureFacilityImportUseCase.importFacilities(sido);
        log.info("cultureFacilityImportJob done. sido={}, imported={}", sido, imported);
        return RepeatStatus.FINISHED;
    }
}
