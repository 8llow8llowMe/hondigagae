package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceImportUseCase;
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
public class PlaceImageBackfillTasklet implements Tasklet {

    private static final String DEFAULT_AREA_CODE = "39";

    private final PlaceImportUseCase placeImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        String areaCode = String.valueOf(chunkContext.getStepContext().getJobParameters()
            .getOrDefault("areaCode", DEFAULT_AREA_CODE));
        int backfilled = placeImportUseCase.backfillPlaceImages(areaCode);
        log.info("place image backfill step finished. areaCode={}, backfilled={}", areaCode, backfilled);
        return RepeatStatus.FINISHED;
    }
}
