package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceImportUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.stereotype.Component;

/**
 * TourAPI 추가 이미지 적재 단계. 장소 적재 단계 뒤에 돈다 —
 * place 테이블의 TourAPI 원천 행이 대상 목록이기 때문이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceImageImportTasklet implements Tasklet {

    private final PlaceImportUseCase placeImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        int imported = placeImportUseCase.importPlaceImages();
        log.info("place image import step finished. images={}", imported);
        return RepeatStatus.FINISHED;
    }
}
