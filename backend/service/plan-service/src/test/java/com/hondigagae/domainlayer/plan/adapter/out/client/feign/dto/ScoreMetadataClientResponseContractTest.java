package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 등급 metadata 를 받는 Feign DTO 셋이 <b>같은 한 벌</b>을 쓰는지, 그리고 그 한 벌이
 * {@code scoreDescription} 까지 받는지 고정한다 (#759).
 *
 * <p><b>이 사고는 두 번 일어났고 두 번 다 아무것도 실패하지 않았다.</b> 같은 패키지에 모양이
 * 같은 {@code ScoreMetadataClientResponse} 가 복제본으로 여럿 있었고, 원천
 * ({@code ScoreMetricDescribable})에 칸이 생겼을 때 한쪽만 고쳐졌다. 남은 쪽은
 * {@code @JsonIgnoreProperties(ignoreUnknown = true)} 때문에 <b>오류 없이 조용히 버렸다</b> —
 * 컴파일도 테스트도 통과하니 "언제나 null 인 필드" 로만 보였고, 실제로 프론트가 그렇게 결론
 * 내린 적이 있다(#717).
 *
 * <p>그래서 검사를 둘로 세운다.
 * <ul>
 *   <li><b>타입 동일성</b> — 세 DTO 의 등급 칸이 <b>같은 클래스</b>여야 한다. 누군가 중첩
 *       레코드로 다시 복제하는 순간 여기서 깨진다. 칸 목록만 비교하면 복제본이 우연히 같은
 *       모양인 동안은 통과하므로, 비교하는 것은 모양이 아니라 <b>클래스</b>다</li>
 *   <li><b>실제 역직렬화</b> — 원천이 보내는 네 칸짜리 JSON 을 넣어 {@code scoreDescription} 이
 *       살아 오는지 본다. 칸이 빠지면 조용히 {@code null} 이 되는 그 자리를 직접 찍는다</li>
 * </ul>
 */
class ScoreMetadataClientResponseContractTest {

    private static final String LEVEL_JSON = """
        {"code":"HIGH","name":"여행 적합","description":"반려견과 방문하기 좋은 조건입니다.",\
        "scoreDescription":"점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다."}""";

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    @DisplayName("세 응답의 등급 칸은 같은 클래스를 쓴다 — 복제본이 다시 생기면 여기서 깨진다")
    void allLevelFieldsShareOneRecord() {
        assertThat(componentType(PlaceSuitabilityClientResponse.class, "suitabilityLevel"))
            .isEqualTo(ScoreMetadataClientResponse.class);
        assertThat(componentType(PlaceWalkSafetyClientResponse.class, "walkSafetyLevel"))
            .isEqualTo(ScoreMetadataClientResponse.class);
        assertThat(componentType(WalkTimesClientResponse.class, "goldenLevel"))
            .isEqualTo(ScoreMetadataClientResponse.class);
    }

    @Test
    @DisplayName("같은 패키지에 ScoreMetadataClientResponse 중첩 복제본이 없다")
    void noNestedDuplicateRemains() {
        List<Class<?>> carriers = List.of(
            PlaceSuitabilityClientResponse.class, PlaceWalkSafetyClientResponse.class, WalkTimesClientResponse.class);

        for (Class<?> carrier : carriers) {
            assertThat(Arrays.stream(carrier.getDeclaredClasses()).map(Class::getSimpleName))
                .as("%s 안에 복제된 중첩 레코드", carrier.getSimpleName())
                .doesNotContain("ScoreMetadataClientResponse");
        }
    }

    @Test
    @DisplayName("적합도 응답의 scoreDescription 이 역직렬화에서 살아 온다 — 이 칸이 버려지던 자리다")
    void suitabilityKeepsScoreDescription() throws Exception {
        PlaceSuitabilityClientResponse body = objectMapper.readValue(
            """
            {"placeId":"100","placeTitle":"협재해수욕장","targetDate":"2026-09-12","score":82,
             "suitabilityLevel":%s,"reasons":[],"indoorAlternatives":[],
             "weatherApplied":true,"congestionApplied":false}""".formatted(LEVEL_JSON),
            PlaceSuitabilityClientResponse.class);

        assertThat(body.suitabilityLevel().scoreDescription())
            .isEqualTo("점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다.");
    }

    @Test
    @DisplayName("산책 위험도·골든타임 응답도 같은 칸을 받는다")
    void walkSafetyAndWalkTimesKeepScoreDescription() throws Exception {
        PlaceWalkSafetyClientResponse walkSafety = objectMapper.readValue(
            """
            {"placeId":"100","placeTitle":"협재해수욕장","targetDateTime":"2026-09-12T10:00:00",
             "walkSafetyLevel":%s,"petConditionApplied":true}""".formatted(LEVEL_JSON),
            PlaceWalkSafetyClientResponse.class);
        WalkTimesClientResponse walkTimes = objectMapper.readValue(
            """
            {"from":"2026-09-12T09:00:00","goldenLevel":%s,"petConditionApplied":true}"""
                .formatted(LEVEL_JSON),
            WalkTimesClientResponse.class);

        assertThat(walkSafety.walkSafetyLevel().scoreDescription()).isNotNull();
        assertThat(walkTimes.goldenLevel().scoreDescription()).isNotNull();
    }

    private static Class<?> componentType(Class<?> record, String componentName) {
        Optional<RecordComponent> component = Arrays.stream(record.getRecordComponents())
            .filter(it -> it.getName().equals(componentName))
            .findFirst();
        assertThat(component).as("%s.%s", record.getSimpleName(), componentName).isPresent();
        return component.orElseThrow().getType();
    }
}
