package com.hondigagae.domainlayer.planner.adapter.out.store;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

/**
 * Redis 에 저장된 잡 JSON 의 호환 (#985).
 *
 * <p>{@code stepStartedAt} 이 생기기 전에 저장된 잡이 배포 중에도 돌고 있다. 그 JSON 을 읽지 못하면
 * {@link RedisAiPlanJobStoreAdapter#findById} 가 "없는 것" 으로 접어 진행 중인 작업이 404 가 된다.
 * 저장소는 스프링이 만든 ObjectMapper 를 쓰므로 같은 빌더로 만든 mapper 로 확인한다.
 */
class AiPlanJobJsonCompatibilityTest {

    private final ObjectMapper objectMapper = Jackson2ObjectMapperBuilder.json().build();

    @Test
    @DisplayName("stepStartedAt 이 없는 옛 저장 데이터도 읽고, 그 값은 null 이다")
    void readsJobSavedBeforeStepStartedAt() throws Exception {
        String saved = """
            {"jobId":"job-1","memberId":7,"requestHash":"hash","requestParams":{"areaCode":"39"},
             "status":"RUNNING","step":"CANDIDATES","errorCode":null,"errorMessage":null,
             "createdAt":"2026-09-30T05:00:00Z","startedAt":"2026-09-30T05:00:01Z","completedAt":null,"planDraft":null}
            """;

        AiPlanJob job = objectMapper.readValue(saved, AiPlanJob.class);

        assertThat(job.status()).isEqualTo(AiPlanJobStatus.RUNNING);
        assertThat(job.step()).isEqualTo(AiPlanJobStep.CANDIDATES);
        assertThat(job.stepStartedAt()).isNull();
    }

    @Test
    @DisplayName("새 필드는 저장·읽기에서 그대로 돌아온다")
    void roundTripsStepStartedAt() throws Exception {
        Instant stepStart = Instant.parse("2026-09-30T05:03:12.345Z");
        AiPlanJob job = AiPlanJob.builder()
            .jobId("job-1").memberId(7L).requestHash("hash").requestParams(Map.of("areaCode", "39"))
            .status(AiPlanJobStatus.RUNNING).createdAt(stepStart)
            .build()
            .atStep(AiPlanJobStep.WEATHER, stepStart);

        AiPlanJob read = objectMapper.readValue(objectMapper.writeValueAsString(job), AiPlanJob.class);

        assertThat(read.stepStartedAt()).isEqualTo(stepStart);
        assertThat(read.step()).isEqualTo(AiPlanJobStep.WEATHER);
    }
}
