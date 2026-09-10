package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 같은 파일인지 판정하는 규칙. 이 판정이 틀리면 둘 중 하나가 난다 —
 * 바뀐 파일을 건너뛰어 데이터가 몇 달 낡거나, 안 바뀐 파일을 매주 30MB 씩 다시 받는다.
 */
class ImportSourceSnapshotTest {

    private static final long RECORDED_LENGTH = 30_633_222L;

    private ImportSourceSnapshot snapshot() {
        return new ImportSourceSnapshot(PlaceSourceType.CULTURE_PORTAL, "39", "FILE_000000003214426",
            "한국문화정보원_20250324.csv", RECORDED_LENGTH, LocalDateTime.of(2025, 3, 24, 0, 0), 228,
            LocalDateTime.of(2026, 9, 8, 3, 0));
    }

    @Test
    @DisplayName("크기를 모르는 시점(내려받기 전)에는 파일 식별자만 같으면 같은 파일이다")
    void matchesOnFileIdWhenLengthUnknown() {
        assertThat(snapshot().sameFileAs("FILE_000000003214426", null)).isTrue();
    }

    @Test
    @DisplayName("식별자가 같아도 바이트 수가 다르면 다른 파일이다")
    void rejectsWhenLengthDiffers() {
        assertThat(snapshot().sameFileAs("FILE_000000003214426", RECORDED_LENGTH + 1)).isFalse();
    }

    @Test
    @DisplayName("식별자가 다르면 크기를 보지 않고 다른 파일이다")
    void rejectsWhenFileIdDiffers() {
        assertThat(snapshot().sameFileAs("FILE_000000009999999", RECORDED_LENGTH)).isFalse();
        assertThat(snapshot().sameFileAs(null, null)).isFalse();
    }
}
