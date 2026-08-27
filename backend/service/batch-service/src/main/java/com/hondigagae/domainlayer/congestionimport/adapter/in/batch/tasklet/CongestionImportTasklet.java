package com.hondigagae.domainlayer.congestionimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.congestionimport.application.port.in.CongestionImportUseCase;
import com.hondigagae.domainlayer.congestionimport.application.port.in.CongestionImportUseCase.CongestionImportResult;
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
public class CongestionImportTasklet implements Tasklet {

    /** 한 페이지 크기. 개발계정 일 1,000건 제한이 있어 페이지를 크게 잡아 호출 수를 줄인다. */
    private static final int DEFAULT_NUM_OF_ROWS = 1000;

    private final CongestionImportUseCase congestionImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Map<String, Object> jobParameters = chunkContext.getStepContext().getJobParameters();
        int numOfRows = intParameter(jobParameters, "numOfRows", DEFAULT_NUM_OF_ROWS);

        CongestionImportResult result = congestionImportUseCase.importJejuCongestion(numOfRows);
        log.info("congestionImportJob done. fetched={}, upserted={}, linked={}, unmatched={}",
            result.fetched(), result.upserted(), result.linked(), result.unmatched());
        return RepeatStatus.FINISHED;
    }

    private int intParameter(Map<String, Object> jobParameters, String key, int defaultValue) {
        Object value = jobParameters.get(key);
        if (value == null || value.toString().isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.toString().trim());
        } catch (NumberFormatException exception) {
            log.warn("Invalid job parameter {}={}, falling back to {}", key, value, defaultValue);
            return defaultValue;
        }
    }
}
