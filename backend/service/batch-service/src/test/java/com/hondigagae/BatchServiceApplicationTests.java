package com.hondigagae;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.application.port.out.ImportSourceSnapshotPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSnapshotPort;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseSnapshot;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.Job;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 컨텍스트 로딩 게이트.
 *
 * <p>batch-service 의 테스트는 전부 단위 테스트라 스프링 컨텍스트를 띄우지 않았다. 그래서 잡 배선의
 * 결함 — 같은 타입({@code Step}) 빈이 10개를 넘는 상태에서 파라미터 이름으로 해소되는가,
 * {@code JobStep} 5개와 {@code .on("*")} 사슬이 조립되는가, 리스너·검증기가 빈으로 붙는가 — 는
 * 컴파일을 통과하고 dev 기동에서야 드러났다(coding-conventions §"컨텍스트 로딩 게이트"). 이 테스트가
 * 그 구멍을 막는다. test 프로파일은 H2 + Eureka 비활성이며 잡은 실행하지 않는다.
 */
@SpringBootTest
@ActiveProfiles("test")
class BatchServiceApplicationTests {

    @Autowired
    private List<Job> jobs;

    @Autowired
    private ImportSourceSnapshotPort importSourceSnapshotPort;

    @Autowired
    private OlleCourseSnapshotPort olleCourseSnapshotPort;

    @Test
    void contextLoads() {
        // 파이프라인 + 자식 5 + 혼잡도 + 올레 코스 = 8. 잡 하나가 빈으로 조립되지 않으면 여기서 먼저 드러난다.
        assertThat(jobs).extracting(Job::getName).containsExactlyInAnyOrder(
            "placeDataPipelineJob", "placeImportJob", "cultureFacilityImportJob", "petRestaurantImportJob",
            "placeMergeJob", "placeImageBackfillJob", "congestionImportJob", "olleCourseImportJob");
    }

    /**
     * {@code spring.sql.init} 이 실제로 스키마를 적용했고 JDBC 어댑터의 SQL 이 그 스키마에 맞는지 본다 (#379).
     *
     * <p>DDL 스크립트도 JdbcTemplate SQL 문자열도 <b>컴파일로 검증되지 않는다.</b> 컬럼명 하나를
     * 틀리면 주 1회 새벽 3시 잡에서야 드러난다. 스크립트는 prod 런북과 같은 파일 하나이므로,
     * 여기서 H2(MODE=MySQL) 로 한 번 돌려 보는 것이 배포 전 마지막 관문이다.
     */
    @Test
    void appliesImportSourceSnapshotSchemaAndRoundTrips() {
        LocalDateTime runStartedAt = LocalDateTime.of(2026, 9, 10, 3, 0);
        importSourceSnapshotPort.record(new ImportSourceSnapshot(PlaceSourceType.CULTURE_PORTAL, "39",
            "FILE_000000003214426", "한국문화정보원_20250324.csv", 30_633_222L,
            LocalDateTime.of(2025, 3, 24, 0, 0), 228, runStartedAt));

        Optional<ImportSourceSnapshot> latest =
            importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, "39");

        assertThat(latest).hasValueSatisfying(snapshot -> {
            assertThat(snapshot.fileId()).isEqualTo("FILE_000000003214426");
            assertThat(snapshot.contentLength()).isEqualTo(30_633_222L);
            assertThat(snapshot.importedCount()).isEqualTo(228);
            assertThat(snapshot.runStartedAt()).isEqualTo(runStartedAt);
            assertThat(snapshot.sameFileAs("FILE_000000003214426", 30_633_222L)).isTrue();
        });
        // 다른 지역의 적재는 이 지역 판정에 섞이지 않는다 (조회 범위가 source + areaCode 다).
        assertThat(importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, "1")).isEmpty();
    }

    @Test
    void appliesOlleCourseSnapshotRoundTripWithoutMixingCultureRows() {
        LocalDateTime runStartedAt = LocalDateTime.of(2026, 9, 10, 5, 0);
        olleCourseSnapshotPort.record(new OlleCourseSnapshot(
            "FILE_000000001111111", "olle.csv", 4_096L, LocalDateTime.of(2025, 4, 28, 0, 0), 29, runStartedAt));

        Optional<OlleCourseSnapshot> latest = olleCourseSnapshotPort.findLatest();

        assertThat(latest).hasValueSatisfying(snapshot -> {
            assertThat(snapshot.fileId()).isEqualTo("FILE_000000001111111");
            assertThat(snapshot.contentLength()).isEqualTo(4_096L);
            assertThat(snapshot.importedCount()).isEqualTo(29);
            assertThat(snapshot.sameFileAs("FILE_000000001111111", 4_096L)).isTrue();
        });
        // 같은 테이블이어도 source 가 다르면 문화정보원 조회에 올레 행이 섞이지 않는다.
        Optional<ImportSourceSnapshot> culture =
            importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, "39");
        assertThat(culture.map(ImportSourceSnapshot::fileId).orElse(null)).isNotEqualTo("FILE_000000001111111");
    }
}
