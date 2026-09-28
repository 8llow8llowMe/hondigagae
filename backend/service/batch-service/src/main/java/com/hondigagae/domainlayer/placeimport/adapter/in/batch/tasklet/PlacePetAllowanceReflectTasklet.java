package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlacePetAllowanceReflectUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.stereotype.Component;

/**
 * TourAPI 장소의 동반 가능 여부 · 크기 제한 재계산 단계 (#886). 완료 로그는 프로세서가 값별 분포와 함께 남긴다.
 *
 * <p>{@code petTourImportJob}(적재 뒤)과 {@code placeMergeJob}(병합 뒤)이 같은 스텝으로 돈다 —
 * {@code PlacePetAllowanceReflectStepConfig}.
 */
@Component
@RequiredArgsConstructor
public class PlacePetAllowanceReflectTasklet implements Tasklet {

    private final PlacePetAllowanceReflectUseCase placePetAllowanceReflectUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        placePetAllowanceReflectUseCase.reflectPetAllowances();
        return RepeatStatus.FINISHED;
    }
}
