package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceMergeUseCase;
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
public class PlaceMergeTasklet implements Tasklet {

    private static final String DEFAULT_AREA_CODE = "39";

    private final PlaceMergeUseCase placeMergeUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Object areaCodeParameter = chunkContext.getStepContext().getJobParameters().get("areaCode");
        // 빈 값(areaCode=)도 기본값으로 떨어뜨린다 — PlaceImportTasklet 과 같은 규칙
        String areaCode = areaCodeParameter == null || areaCodeParameter.toString().isBlank()
            ? DEFAULT_AREA_CODE
            : areaCodeParameter.toString().trim();
        int merged = placeMergeUseCase.mergeDuplicates(areaCode);
        log.info("place merge step finished. areaCode={}, merged={}", areaCode, merged);
        return RepeatStatus.FINISHED;
    }
}
