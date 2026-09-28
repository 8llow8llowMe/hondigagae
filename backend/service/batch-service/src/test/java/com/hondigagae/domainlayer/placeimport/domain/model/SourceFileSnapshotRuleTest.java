package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 문화정보원·올레가 함께 쓰는 "같은 파일인가" 규칙 (#379 · #887).
 *
 * <p>틀리면 둘 중 하나가 난다 — 바뀐 파일(또는 우회 뒤 되살아난 포털 파일)을 건너뛰어 데이터가
 * 조용히 낡거나, 안 바뀐 파일을 매주 다시 받는다.
 */
class SourceFileSnapshotRuleTest {

    private static final String FILE_ID = "FILE_000000003214426";
    private static final long LENGTH = 30_633_222L;

    @Test
    @DisplayName("크기를 모르는 시점에는 파일 식별자만 같으면 같은 파일이다")
    void matchesOnFileIdWhenLengthUnknown() {
        assertThat(SourceFileSnapshotRule.sameFile(FILE_ID, LENGTH, FILE_ID, null)).isTrue();
    }

    @Test
    @DisplayName("식별자와 크기가 모두 같아야 같은 파일이다")
    void requiresBothKeysWhenLengthKnown() {
        assertThat(SourceFileSnapshotRule.sameFile(FILE_ID, LENGTH, FILE_ID, LENGTH)).isTrue();
        assertThat(SourceFileSnapshotRule.sameFile(FILE_ID, LENGTH, FILE_ID, LENGTH + 1)).isFalse();
        assertThat(SourceFileSnapshotRule.sameFile(FILE_ID, LENGTH, "FILE_000000009999999", LENGTH)).isFalse();
        assertThat(SourceFileSnapshotRule.sameFile(null, LENGTH, FILE_ID, null)).isFalse();
        assertThat(SourceFileSnapshotRule.sameFile(FILE_ID, LENGTH, null, null)).isFalse();
    }

    @Test
    @DisplayName("직전 행이 우회 행이면 어떤 포털 파일과도 같은 파일이 아니다 (#887)")
    void fallbackRowNeverMatches() {
        String marker = SourceFileSnapshotRule.FALLBACK_FILE_ID;

        assertThat(SourceFileSnapshotRule.isFallbackMarker(marker)).isTrue();
        assertThat(SourceFileSnapshotRule.sameFile(marker, SourceFileSnapshotRule.FALLBACK_CONTENT_LENGTH, FILE_ID, null)).isFalse();
        // 포털이 마커와 같은 문자열을 식별자로 내더라도 우회 행은 비교 기준이 되지 않는다.
        assertThat(SourceFileSnapshotRule.sameFile(marker, 0L, marker, null)).isFalse();
        assertThat(SourceFileSnapshotRule.sameFile(marker, 0L, marker, 0L)).isFalse();
    }

    @Test
    @DisplayName("포털 atchFileId 는 우회 마커가 아니다")
    void portalFileIdIsNotMarker() {
        assertThat(SourceFileSnapshotRule.isFallbackMarker(FILE_ID)).isFalse();
        assertThat(SourceFileSnapshotRule.isFallbackMarker(null)).isFalse();
    }
}
