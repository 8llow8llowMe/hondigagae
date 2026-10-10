package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase.CultureFacilityImportResult;
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
    /** 참으로 인정하는 유일한 값. 오타("ture"·"1")를 조용히 참으로 읽으면 매주 30MB 를 다시 받는다. */
    private static final String FORCE_IMPORT_TRUE = "true";

    private final CultureFacilityImportUseCase cultureFacilityImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Map<String, Object> jobParameters = chunkContext.getStepContext().getJobParameters();

        Object sidoParameter = jobParameters.get("sido");
        String sido = sidoParameter == null || sidoParameter.toString().isBlank()
            ? DEFAULT_SIDO
            : sidoParameter.toString();

        Object forceParameter = jobParameters.get("forceImport");
        boolean forceImport = forceParameter != null && FORCE_IMPORT_TRUE.equalsIgnoreCase(forceParameter.toString().trim());

        CultureFacilityImportResult result = cultureFacilityImportUseCase.importFacilities(sido, forceImport);
        log.info("cultureFacilityImportJob done. sido={} imported={} skippedUnchanged={} fileId={} fallback={}",
            sido, result.imported(), result.skippedUnchanged(), result.fileId(), result.fallbackUsed());
        return RepeatStatus.FINISHED;
    }
}
