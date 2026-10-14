package com.hondigagae.domainlayer.placeimport.adapter.out.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceOverride;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;

/**
 * 장소 보정 파일 로더 (#1434).
 *
 * <p><b>첫 테스트는 배포될 실제 파일을 읽는다.</b> 보정 파일은 손으로 고치는 YAML 이라 오타(칸 이름 · enum · 빠진 근거)가 컴파일로 잡히지 않는다 —
 * 운영의 새벽 배치에서 스텝이 실패하기 전에 CI 에서 걸리게 둔다.
 */
class PlaceOverrideYamlAdapterTest {

    @Test
    @DisplayName("배포될 place-overrides.yml 이 규칙대로 읽힌다 — 오타가 CI 에서 잡힌다")
    void loadsRealOverrideFile() {
        List<PlaceOverride> overrides = new PlaceOverrideYamlAdapter().readOverrides();

        assertThat(overrides).isNotEmpty();
        assertThat(overrides).extracting(PlaceOverride::placeId).doesNotHaveDuplicates();
        Map<Long, PlaceOverride> byId = overrides.stream().collect(Collectors.toMap(PlaceOverride::placeId, override -> override));

        // 한림공원 — 대부분 야외 정원인데 원천의 실내 Y 로 '실내' 로 보였다
        assertThat(byId.get(126455L)).satisfies(hallim -> {
            assertThat(hallim.expectedTitle()).isEqualTo("한림공원");
            assertThat(hallim.indoor()).isFalse();
            assertThat(hallim.outdoor()).isTrue();
            assertThat(hallim.petAllowanceType()).isNull();
        });
        // 다이소 9곳 — 원천끼리 어긋나 동반 구분을 모름으로 둔다
        List<Long> daisoIds = List.of(2907285L, 4026812L, 4026821L, 4026823L, 4026862L, 4026870L, 4026810L, 4026871L, 4026872L);
        assertThat(daisoIds).allSatisfy(id -> {
            assertThat(byId).containsKey(id);
            assertThat(byId.get(id).expectedTitle()).startsWith("다이소 ");
            assertThat(byId.get(id).petAllowanceType()).isEqualTo(PetAllowanceType.UNKNOWN);
            assertThat(byId.get(id).indoor()).isNull();
            assertThat(byId.get(id).outdoor()).isNull();
        });
        assertThat(overrides).hasSize(1 + daisoIds.size());
    }

    @Test
    @DisplayName("적은 칸만 읽고, 적지 않은 칸은 null(그대로)이다")
    void readsOnlyWrittenColumns() {
        List<PlaceOverride> overrides = read("""
            overrides:
              - placeId: 126455
                expectedTitle: 한림공원
                outdoor: true
                reason: 야외 정원
                evidence:
                  - 사용성 테스트 2026-10-13
            """);

        assertThat(overrides).containsExactly(
            new PlaceOverride(126455L, "한림공원", null, true, null, "야외 정원", List.of("사용성 테스트 2026-10-13")));
    }

    @Test
    @DisplayName("빈 목록은 항목 0개다")
    void readsEmptyList() {
        assertThat(read("overrides: []\n")).isEmpty();
    }

    @Test
    @DisplayName("reason · evidence 가 비면 읽는 순간 실패한다")
    void rejectsMissingReasonOrEvidence() {
        assertInvalid("reason 이 비었다", """
            overrides:
              - placeId: 126455
                expectedTitle: 한림공원
                indoor: false
                reason: " "
                evidence: [근거]
            """);
        assertInvalid("evidence 가 비었거나", """
            overrides:
              - placeId: 126455
                expectedTitle: 한림공원
                indoor: false
                reason: 야외 정원
            """);
    }

    @Test
    @DisplayName("모르는 enum 값 · 모르는 칸 이름 · 같은 칸 두 번은 읽는 순간 실패한다 — 오타가 조용히 무시되지 않는다")
    void rejectsTypos() {
        assertInvalid("UNKNWON", """
            overrides:
              - placeId: 2907285
                expectedTitle: 다이소 제주연동점
                petAllowanceType: UNKNWON
                reason: 원천끼리 어긋난다
                evidence: [근거]
            """);
        assertInvalid("Unrecognized field \"indor\"", """
            overrides:
              - placeId: 126455
                expectedTitle: 한림공원
                indor: false
                reason: 야외 정원
                evidence: [근거]
            """);
        assertInvalid("Duplicate field 'indoor'", """
            overrides:
              - placeId: 126455
                expectedTitle: 한림공원
                indoor: false
                indoor: true
                reason: 야외 정원
                evidence: [근거]
            """);
    }

    @Test
    @DisplayName("YAML 별칭은 실패한다 — Jackson 은 별칭을 내용이 아니라 앵커 이름으로 읽어 근거가 조용히 사라진다")
    void rejectsAliases() {
        assertInvalid("YAML 별칭(*daiso)", """
            overrides:
              - placeId: 2907285
                expectedTitle: 다이소 제주연동점
                petAllowanceType: UNKNOWN
                reason: &daiso 원천끼리 어긋난다
                evidence: [근거]
              - placeId: 4026812
                expectedTitle: 다이소 서귀포중문점
                petAllowanceType: UNKNOWN
                reason: *daiso
                evidence: [근거]
            """);
    }

    @Test
    @DisplayName("placeId 가 없거나 같은 id 가 두 번 나오면 실패한다")
    void rejectsMissingOrDuplicatedPlaceId() {
        assertInvalid("placeId 가 없다", """
            overrides:
              - expectedTitle: 한림공원
                indoor: false
                reason: 야외 정원
                evidence: [근거]
            """);
        assertInvalid("두 번 나온다", """
            overrides:
              - placeId: 126455
                expectedTitle: 한림공원
                indoor: false
                reason: 야외 정원
                evidence: [근거]
              - placeId: 126455
                expectedTitle: 한림공원
                outdoor: true
                reason: 야외 정원
                evidence: [근거]
            """);
    }

    @Test
    @DisplayName("파일이 없으면 실패한다 — 배포물에서 빠진 것이다")
    void rejectsMissingFile() {
        PlaceOverrideYamlAdapter adapter = new PlaceOverrideYamlAdapter(new ClassPathResource("no-such-place-overrides.yml"));

        assertThatThrownBy(adapter::readOverrides)
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID);
    }

    private static List<PlaceOverride> read(String yaml) {
        return new PlaceOverrideYamlAdapter(new ByteArrayResource(yaml.getBytes(StandardCharsets.UTF_8))).readOverrides();
    }

    /** 오류 코드와 함께 이유 조각까지 본다 — 다른 이유로 실패해도 통과하는 테스트가 되지 않게. */
    private static void assertInvalid(String reasonFragment, String yaml) {
        assertThatThrownBy(() -> read(yaml))
            .isInstanceOf(PlaceImportException.class)
            .hasMessageContaining(reasonFragment)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID);
    }
}
