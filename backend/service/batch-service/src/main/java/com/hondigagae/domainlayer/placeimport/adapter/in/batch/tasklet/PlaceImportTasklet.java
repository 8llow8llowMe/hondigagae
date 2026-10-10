package com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet;

import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceImportUseCase;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import java.util.Arrays;
import java.util.List;
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
public class PlaceImportTasklet implements Tasklet {

    private static final String DEFAULT_AREA_CODE = "39"; // 제주

    private final PlaceImportUseCase placeImportUseCase;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        Map<String, Object> jobParameters = chunkContext.getStepContext().getJobParameters();

        String areaCode = stringParameter(jobParameters, "areaCode", DEFAULT_AREA_CODE);
        List<PlaceContentType> contentTypes = parseContentTypes(stringParameter(jobParameters, "contentTypeIds", null));

        int upserted = placeImportUseCase.importPlaces(areaCode, contentTypes);
        log.info("placeImportJob done. areaCode={}, upserted={}", areaCode, upserted);
        return RepeatStatus.FINISHED;
    }

    private String stringParameter(Map<String, Object> jobParameters, String key, String defaultValue) {
        Object value = jobParameters.get(key);
        if (value == null || value.toString().isBlank()) {
            return defaultValue;
        }
        return value.toString();
    }

    private List<PlaceContentType> parseContentTypes(String contentTypeIds) {
        if (contentTypeIds == null) {
            return List.of();
        }
        return Arrays.stream(contentTypeIds.split(","))
            .map(String::trim)
            .filter(code -> !code.isBlank())
            .map(PlaceContentType::fromCode)
            .toList();
    }
}
