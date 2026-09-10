package com.hondigagae.domainlayer.walkcourseimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.walkcourseimport.application.port.in.WalkCourseImportUseCase;
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
public class OlleCourseImportTasklet implements Tasklet {

    private final WalkCourseImportUseCase walkCourseImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        int upserted = walkCourseImportUseCase.importOlleCourses();
        log.info("olleCourseImportJob done. upserted={}", upserted);
        return RepeatStatus.FINISHED;
    }
}
