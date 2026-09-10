package com.hondigagae.domainlayer.walkcourseimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.walkcourseimport.application.port.in.WalkCourseImportUseCase;
import com.hondigagae.domainlayer.walkcourseimport.application.port.in.WalkCourseImportUseCase.OlleCourseImportResult;
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
public class OlleCourseImportTasklet implements Tasklet {

    /** 참으로 인정하는 유일한 값. 오타를 조용히 참으로 읽으면 매주 같은 파일을 다시 받는다. */
    private static final String FORCE_IMPORT_TRUE = "true";

    private final WalkCourseImportUseCase walkCourseImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Map<String, Object> jobParameters = chunkContext.getStepContext().getJobParameters();
        Object forceParameter = jobParameters.get("forceImport");
        boolean forceImport = forceParameter != null && FORCE_IMPORT_TRUE.equalsIgnoreCase(forceParameter.toString().trim());

        OlleCourseImportResult result = walkCourseImportUseCase.importOlleCourses(forceImport);
        log.info("olleCourseImportJob done. imported={} skippedUnchanged={} fileId={} fallback={}",
            result.imported(), result.skippedUnchanged(), result.fileId(), result.fallbackUsed());
        return RepeatStatus.FINISHED;
    }
}
