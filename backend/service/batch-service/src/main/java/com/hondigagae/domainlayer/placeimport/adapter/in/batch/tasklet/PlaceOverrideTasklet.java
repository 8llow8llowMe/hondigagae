package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceOverrideUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.stereotype.Component;

/**
 * 장소 보정 단계 (#1434). 항목별 한 줄과 완료 로그는 프로세서가 남긴다.
 *
 * <p>보정 칸을 다시 쓰는 잡 넷이 같은 스텝을 마지막 단계로 돈다 — {@code PlaceOverrideStepConfig}.
 */
@Component
@RequiredArgsConstructor
public class PlaceOverrideTasklet implements Tasklet {

    private final PlaceOverrideUseCase placeOverrideUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        placeOverrideUseCase.applyOverrides();
        return RepeatStatus.FINISHED;
    }
}
