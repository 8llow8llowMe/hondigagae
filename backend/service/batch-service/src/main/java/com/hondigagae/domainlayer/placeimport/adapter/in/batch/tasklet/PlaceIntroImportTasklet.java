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
 * TourAPI 상세 소개(detailIntro2) 적재 단계. 장소 적재 단계 뒤에 돈다 —
 * place 테이블의 TourAPI 원천 행이 대상 목록이기 때문이다.
 *
 * <p>쿼터 때문에 한 실행에서 전량을 덮지 않는다. 실행당 상한만큼만 호출하고 나머지는
 * 다음 실행이 가져간다 ({@code PlaceIntroImportProperties}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceIntroImportTasklet implements Tasklet {

    private final PlaceImportUseCase placeImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        int upserted = placeImportUseCase.importPlaceIntros();
        log.info("place intro import step finished. intros={}", upserted);
        return RepeatStatus.FINISHED;
    }
}
