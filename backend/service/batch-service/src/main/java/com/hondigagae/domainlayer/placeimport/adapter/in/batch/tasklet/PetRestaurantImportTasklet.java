package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PetRestaurantImportUseCase;
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
public class PetRestaurantImportTasklet implements Tasklet {

    /** 원천의 지역 표기를 그대로 쓴다 — 시도 명칭이 아니라 "제주"다. */
    private static final String DEFAULT_REGION = "제주";

    private final PetRestaurantImportUseCase petRestaurantImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Map<String, Object> jobParameters = chunkContext.getStepContext().getJobParameters();

        Object regionParameter = jobParameters.get("region");
        String region = regionParameter == null || regionParameter.toString().isBlank()
            ? DEFAULT_REGION
            : regionParameter.toString();

        int imported = petRestaurantImportUseCase.importPetRestaurants(region);
        log.info("petRestaurantImportJob done. region={}, imported={}", region, imported);
        return RepeatStatus.FINISHED;
    }
}
