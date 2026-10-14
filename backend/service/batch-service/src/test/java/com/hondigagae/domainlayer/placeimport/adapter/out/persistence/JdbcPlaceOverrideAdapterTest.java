package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.application.model.PlaceOverrideOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceOverrideTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceOverrideProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlacePetAllowanceReflectProcessor;
import com.hondigagae.domainlayer.placeimport.domain.model.OverridablePlace;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceOverride;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * 장소 보정의 <b>실제 SQL</b> 을 H2(MODE=MySQL)에 돌린다 (#1434).
 *
 * <p>JdbcTemplate SQL 문자열은 컴파일로 검증되지 않는다. place 스키마의 정본은 tour-service JPA 엔티티라 이 서비스에 DDL 이 없으므로,
 * 보정과 동반 재계산이 읽고 쓰는 컬럼만 같은 이름 · 타입으로 만든다. "합친 다섯 칸을 그대로 쓴다 · 제목이 다르면 쓰지 않는다 ·
 * 재계산과 서로 되돌리지 않는다(다시 돌리면 0행)" 를 DB 위에서 고정한다.
 *
 * <p><b>H2 의 {@code BOOLEAN} 은 MySQL 의 {@code BIT(1)} 이 아니다.</b> {@code COALESCE(?, col)} 같은 SQL 쪽 합치기의 형 병합 문제는 여기서
 * 드러나지 않는다 — 그래서 어댑터는 값을 SQL 에서 합치지 않는 모양으로 막고(평범한 파라미터), 이 테스트는 그 모양의 결과를 본다.
 */
class JdbcPlaceOverrideAdapterTest {

    private static final List<String> EVIDENCE = List.of("사용성 테스트 2026-10-13 (#1434)");

    private JdbcTemplate jdbcTemplate;
    private JdbcPlaceOverrideAdapter adapter;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
            "jdbc:h2:mem:place-override-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("""
            CREATE TABLE place (
                id BIGINT NOT NULL PRIMARY KEY,
                source VARCHAR(20) NOT NULL,
                title VARCHAR(200) NOT NULL,
                lat DECIMAL(13, 10) NULL,
                lng DECIMAL(13, 10) NULL,
                indoor BOOLEAN NULL,
                outdoor BOOLEAN NULL,
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
        adapter = new JdbcPlaceOverrideAdapter(jdbcTemplate);
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.execute("SHUTDOWN");
    }

    @Test
    @DisplayName("대상 행을 한 번에 읽고, 모름(NULL)은 null 로 돌려준다. 없는 id 는 결과에 없다")
    void readsTargetsKeepingUnknownAsNull() {
        insert(126455L, "TOUR_API", "한림공원", true, true, "ALLOWED", "ALL", true);
        insert(2907285L, "TOUR_API", "다이소 제주연동점", null, null, "ALLOWED", "SMALL_ONLY", true);

        List<PlaceOverrideTargetQueryResult> targets = adapter.findTargets(List.of(126455L, 2907285L, 9L));

        assertThat(targets).containsExactlyInAnyOrder(
            new PlaceOverrideTargetQueryResult(126455L, "TOUR_API", "한림공원", true, true, "ALLOWED", "ALL", true),
            new PlaceOverrideTargetQueryResult(2907285L, "TOUR_API", "다이소 제주연동점", null, null, "ALLOWED", "SMALL_ONLY", true));
        assertThat(adapter.findTargets(List.of())).isEmpty();
    }

    @Test
    @DisplayName("합친 다섯 칸을 그대로 쓰고(NULL 포함), 제목이 다른 행은 쓰지 않는다")
    void writesMergedColumnsWhenTitleMatches() {
        insert(126455L, "TOUR_API", "한림공원", true, true, "ALLOWED", "ALL", true);
        insert(2907285L, "TOUR_API", "다이소 제주연동점", true, null, "ALLOWED", "ALL", true);
        insert(4026812L, "TOUR_API", "올리브영 중문점", null, null, "ALLOWED", "ALL", true);

        int updated = adapter.applyOverrides(List.of(
            new OverridablePlace(126455L, "한림공원", false, true, "ALLOWED", "ALL", true),
            new OverridablePlace(2907285L, "다이소 제주연동점", true, null, "UNKNOWN", "UNKNOWN", false),
            // 읽은 뒤 id 가 다른 장소를 가리키게 됐다 — 쓰지 않는다
            new OverridablePlace(4026812L, "다이소 서귀포중문점", null, null, "UNKNOWN", "UNKNOWN", false)));

        assertThat(updated).isEqualTo(2);
        assertThat(row(126455L)).containsEntry("INDOOR", false).containsEntry("OUTDOOR", true)
            .containsEntry("PET_ALLOWANCE_TYPE", "ALLOWED").containsEntry("ALLOWED_PET_SIZE", "ALL").containsEntry("PET_AVAILABLE", true);
        assertThat(row(2907285L)).containsEntry("INDOOR", true).containsEntry("OUTDOOR", null)
            .containsEntry("PET_ALLOWANCE_TYPE", "UNKNOWN").containsEntry("ALLOWED_PET_SIZE", "UNKNOWN").containsEntry("PET_AVAILABLE", false);
        assertThat(row(4026812L)).containsEntry("PET_ALLOWANCE_TYPE", "ALLOWED").containsEntry("ALLOWED_PET_SIZE", "ALL").containsEntry("PET_AVAILABLE", true);
    }

    @Test
    @DisplayName("프로세서와 함께 — 적은 칸만 바뀌고, 다시 돌리면 0행이다")
    void appliesThroughProcessorAndIsIdempotent() {
        insert(126455L, "TOUR_API", "한림공원", true, true, "ALLOWED", "ALL", true);
        insert(2907285L, "TOUR_API", "다이소 제주연동점", null, null, "ALLOWED", "ALL", true);
        List<PlaceOverride> overrides = List.of(
            new PlaceOverride(126455L, "한림공원", false, true, null, "야외 정원", EVIDENCE),
            new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE),
            new PlaceOverride(9L, "없는 장소", false, null, null, "근거", EVIDENCE));
        PlaceOverrideProcessor processor = new PlaceOverrideProcessor(() -> overrides, adapter);

        assertThat(processor.applyOverrides()).isEqualTo(new PlaceOverrideOutcome(3, 2, 2, 1, 0));
        assertThat(processor.applyOverrides()).isEqualTo(new PlaceOverrideOutcome(3, 2, 0, 1, 0));
        // 한림공원은 실내외만 — 동반 칸은 그대로다
        assertThat(row(126455L)).containsEntry("INDOOR", false).containsEntry("OUTDOOR", true)
            .containsEntry("PET_ALLOWANCE_TYPE", "ALLOWED").containsEntry("ALLOWED_PET_SIZE", "ALL").containsEntry("PET_AVAILABLE", true);
    }

    @Test
    @DisplayName("재계산 → 보정을 두 번 돌리면 두 번째는 두 스텝 모두 0행이다 — 서로 되돌리지 않는다")
    void reflectAndOverrideDoNotUndoEachOther() {
        // #1434 배포 전 상태 — 재계산이 원천 근거(전구역)로 ALLOWED 를 써 두었다
        insert(2907285L, "TOUR_API", "다이소 제주연동점", null, null, "ALLOWED", "ALL", true);
        petInfo(2907285L, "FULL_AREA", "ALL");
        insert(1L, "TOUR_API", "보정 없는 장소", null, null, "UNKNOWN", "UNKNOWN", false);
        petInfo(1L, "FULL_AREA", "ALL");
        List<PlaceOverride> overrides =
            List.of(new PlaceOverride(2907285L, "다이소 제주연동점", null, null, PetAllowanceType.UNKNOWN, "원천끼리 어긋난다", EVIDENCE));
        PlacePetAllowanceReflectProcessor reflect = new PlacePetAllowanceReflectProcessor(new JdbcPlacePetAllowanceAdapter(jdbcTemplate), () -> overrides);
        PlaceOverrideProcessor override = new PlaceOverrideProcessor(() -> overrides, adapter);

        assertThat(reflect.reflectPetAllowances().changed()).isEqualTo(1);    // 1 만 — 다이소는 걸러져 ALLOWED 그대로다
        assertThat(row(2907285L)).containsEntry("PET_ALLOWANCE_TYPE", "ALLOWED");
        assertThat(override.applyOverrides().changed()).isEqualTo(1);         // 다이소의 첫 보정 — 배포 뒤 한 번뿐이다

        assertThat(reflect.reflectPetAllowances().changed()).isZero();
        PlaceOverrideOutcome second = override.applyOverrides();
        assertThat(second.changed()).isZero();
        assertThat(second.applied()).isEqualTo(1);
        // 동반 UNKNOWN 이면 크기 제한도 UNKNOWN — allowedPetSize=ALL 필터에 잡히지 않는다
        assertThat(row(2907285L)).containsEntry("PET_ALLOWANCE_TYPE", "UNKNOWN").containsEntry("ALLOWED_PET_SIZE", "UNKNOWN")
            .containsEntry("PET_AVAILABLE", false);
        assertThat(row(1L)).containsEntry("PET_ALLOWANCE_TYPE", "ALLOWED").containsEntry("ALLOWED_PET_SIZE", "ALL");
    }

    private void insert(long id, String source, String title, Boolean indoor, Boolean outdoor, String allowance, String size, boolean petAvailable) {
        jdbcTemplate.update("""
            INSERT INTO place (id, source, title, indoor, outdoor, pet_allowance_type, allowed_pet_size, pet_available)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            id, source, title, indoor, outdoor, allowance, size, petAvailable);
    }

    private void petInfo(long placeId, String scope, String size) {
        jdbcTemplate.update("INSERT INTO place_pet_info (id, place_id, allowance_scope, allowed_pet_size) VALUES (?, ?, ?, ?)",
            placeId + 1_000_000L, placeId, scope, size);
    }

    private Map<String, Object> row(long id) {
        return jdbcTemplate.queryForMap("SELECT indoor, outdoor, pet_allowance_type, allowed_pet_size, pet_available FROM place WHERE id = ?", id);
    }
}
