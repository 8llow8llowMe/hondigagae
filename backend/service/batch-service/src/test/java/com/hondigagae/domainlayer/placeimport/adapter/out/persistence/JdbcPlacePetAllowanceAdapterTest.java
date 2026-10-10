package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.application.model.PetAllowanceReflectOutcome;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlacePetAllowanceReflectProcessor;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * 동반 가능 여부 재계산의 <b>실제 SQL</b> 을 H2(MODE=MySQL)에 돌린다 (#886).
 *
 * <p>JdbcTemplate SQL 문자열은 컴파일로 검증되지 않는다. place · place_pet_info 스키마의 정본은 tour-service JPA 엔티티라
 * 이 서비스에 DDL 이 없으므로, 재계산이 읽고 쓰는 컬럼만 같은 이름 · 타입으로 만든다. 어댑터와 프로세서를 함께 돌려
 * "대상 범위 · 근거 조합 · 멱등 · 근거가 사라지면 되돌아감" 을 DB 위에서 고정한다.
 */
class JdbcPlacePetAllowanceAdapterTest {

    private JdbcTemplate jdbcTemplate;
    private PlacePetAllowanceReflectProcessor processor;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
            "jdbc:h2:mem:pet-allowance-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("""
            CREATE TABLE place (
                id BIGINT NOT NULL PRIMARY KEY,
                source VARCHAR(20) NOT NULL,
                title VARCHAR(200) NOT NULL,
                pet_allowance_type VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
                allowed_pet_size VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
                pet_available BOOLEAN NOT NULL DEFAULT FALSE,
                merged_into_id BIGINT NULL,
                delisted_at DATETIME(6) NULL,
                updated_at DATETIME(6) NULL
            )""");
        jdbcTemplate.execute("""
            CREATE TABLE place_pet_info (
                id BIGINT NOT NULL PRIMARY KEY,
                place_id BIGINT NOT NULL,
                allowance_scope VARCHAR(20) NOT NULL,
                allowed_pet_size VARCHAR(20) NOT NULL,
                CONSTRAINT uk_place_pet_info_place_id UNIQUE (place_id)
            )""");
        processor = new PlacePetAllowanceReflectProcessor(new JdbcPlacePetAllowanceAdapter(jdbcTemplate));
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.execute("SHUTDOWN");
    }

    @Test
    @DisplayName("동반 정보 · 흡수 행 근거에서 가장 제한적인 값을 TourAPI 노출 행에 쓴다")
    void reflectsBothEvidenceSources() {
        tourApi(1L);                                   // 동반 정보만 — 전구역 · 전 견종
        petInfo(1L, "FULL_AREA", "ALL");
        tourApi(2L);                                   // 흡수 행만 — 문화정보원 동반 불가
        absorbed(102L, 2L, "NOT_ALLOWED", "UNKNOWN");
        tourApi(3L);                                   // 둘이 다르다 — 흡수 ALLOWED ↔ 동반 정보 일부구역
        petInfo(3L, "PARTIAL", "ALL");
        absorbed(103L, 3L, "ALLOWED", "SMALL_ONLY");
        tourApi(4L);                                   // 흡수 행 둘 — 더 제한적인 쪽
        absorbed(104L, 4L, "ALLOWED", "SMALL_MEDIUM");
        absorbed(114L, 4L, "PARTIALLY_ALLOWED", "ALL");
        tourApi(5L);                                   // 두 근거 모두 UNKNOWN
        petInfo(5L, "UNKNOWN", "UNKNOWN");
        absorbed(105L, 5L, "UNKNOWN", "UNKNOWN");
        tourApi(6L);                                   // 근거 없음 — NOT_ALLOWED 로 만들지 않는다
        petInfo(7L, "OUTDOOR_ONLY", "SMALL_ONLY");
        tourApi(7L);                                   // 실외만 → 일부

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        assertThat(valuesOf(1L)).isEqualTo("ALLOWED/ALL");
        assertThat(valuesOf(2L)).isEqualTo("NOT_ALLOWED/UNKNOWN");
        assertThat(valuesOf(3L)).isEqualTo("PARTIALLY_ALLOWED/SMALL_ONLY");
        assertThat(valuesOf(4L)).isEqualTo("PARTIALLY_ALLOWED/SMALL_MEDIUM");
        assertThat(valuesOf(5L)).isEqualTo("UNKNOWN/UNKNOWN");
        assertThat(valuesOf(6L)).isEqualTo("UNKNOWN/UNKNOWN");
        assertThat(valuesOf(7L)).isEqualTo("PARTIALLY_ALLOWED/SMALL_ONLY");
        // pet_available 은 동반 구분을 따른다 — ALLOWED · PARTIALLY_ALLOWED 만 true
        assertThat(petAvailableOf(1L)).isTrue();
        assertThat(petAvailableOf(2L)).isFalse();
        assertThat(petAvailableOf(3L)).isTrue();
        assertThat(petAvailableOf(6L)).isFalse();
        assertThat(petAvailableOf(7L)).isTrue();
        // 흡수 행이 여럿이어도 대상은 한 번만 센다
        assertThat(outcome.targets()).isEqualTo(7);
        assertThat(outcome.changed()).isEqualTo(5);
        assertThat(outcome.sizeRestricted()).isEqualTo(3);
    }

    @Test
    @DisplayName("문화정보원 · 식약처 노출 행과 병합 · delisted 된 TourAPI 행은 건드리지 않는다")
    void leavesRowsOutsideTheTargetUntouched() {
        insertPlace(10L, "CULTURE_PORTAL", "NOT_ALLOWED", "SMALL_ONLY", null, false);
        insertPlace(11L, "MFDS", "ALLOWED", "UNKNOWN", null, false);
        insertPlace(12L, "TOUR_API", "ALLOWED", "ALL", 1L, false);    // 다른 TourAPI 행으로 흡수됨
        insertPlace(13L, "TOUR_API", "ALLOWED", "ALL", null, true);   // delisted
        petInfo(13L, "PARTIAL", "SMALL_ONLY");
        tourApi(1L);

        PetAllowanceReflectOutcome outcome = processor.reflectPetAllowances();

        assertThat(valuesOf(10L)).isEqualTo("NOT_ALLOWED/SMALL_ONLY");
        assertThat(valuesOf(11L)).isEqualTo("ALLOWED/UNKNOWN");
        assertThat(valuesOf(13L)).isEqualTo("ALLOWED/ALL");
        // 12 는 1 의 근거로만 쓰였다 — 흡수 행 자신의 값은 그대로다
        assertThat(valuesOf(12L)).isEqualTo("ALLOWED/ALL");
        assertThat(valuesOf(1L)).isEqualTo("ALLOWED/ALL");
        assertThat(outcome.targets()).isEqualTo(1);
    }

    @Test
    @DisplayName("다시 돌리면 0행이고, 근거가 사라지면 값이 돌아간다 — 동반 정보 삭제 · 흡수 행 delist")
    void isIdempotentAndRevertsWhenEvidenceDisappears() {
        tourApi(1L);
        petInfo(1L, "FULL_AREA", "SMALL_ONLY");
        tourApi(2L);
        absorbed(102L, 2L, "NOT_ALLOWED", "SMALL_MEDIUM");

        processor.reflectPetAllowances();
        assertThat(valuesOf(1L)).isEqualTo("ALLOWED/SMALL_ONLY");
        assertThat(petAvailableOf(1L)).isTrue();
        assertThat(valuesOf(2L)).isEqualTo("NOT_ALLOWED/SMALL_MEDIUM");

        assertThat(processor.reflectPetAllowances().changed()).isZero();

        jdbcTemplate.update("DELETE FROM place_pet_info WHERE place_id = 1");
        jdbcTemplate.update("UPDATE place SET delisted_at = NOW() WHERE id = 102");
        PetAllowanceReflectOutcome reverted = processor.reflectPetAllowances();

        assertThat(valuesOf(1L)).isEqualTo("UNKNOWN/UNKNOWN");
        assertThat(valuesOf(2L)).isEqualTo("UNKNOWN/UNKNOWN");
        assertThat(petAvailableOf(1L)).isFalse();
        assertThat(reverted.changed()).isEqualTo(2);
    }

    private void tourApi(long id) {
        insertPlace(id, "TOUR_API", "UNKNOWN", "UNKNOWN", null, false);
    }

    private void absorbed(long id, long survivorId, String allowance, String size) {
        insertPlace(id, "CULTURE_PORTAL", allowance, size, survivorId, false);
    }

    private void insertPlace(long id, String source, String allowance, String size, Long mergedIntoId, boolean delisted) {
        jdbcTemplate.update("""
            INSERT INTO place (id, source, title, pet_allowance_type, allowed_pet_size, merged_into_id, delisted_at)
            VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? THEN NOW() END)""",
            id, source, "place-" + id, allowance, size, mergedIntoId, delisted);
    }

    private void petInfo(long placeId, String scope, String size) {
        jdbcTemplate.update("INSERT INTO place_pet_info (id, place_id, allowance_scope, allowed_pet_size) VALUES (?, ?, ?, ?)",
            placeId + 1_000_000L, placeId, scope, size);
    }

    private String valuesOf(long placeId) {
        return jdbcTemplate.queryForObject("SELECT CONCAT(pet_allowance_type, '/', allowed_pet_size) FROM place WHERE id = ?",
            String.class, placeId);
    }

    private boolean petAvailableOf(long placeId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("SELECT pet_available FROM place WHERE id = ?", Boolean.class, placeId));
    }
}
