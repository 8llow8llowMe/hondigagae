package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.ImportSourceSnapshotPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 원천 파일 스냅샷 저장소 (#379).
 *
 * <p>append-only 다. UPDATE 하지 않고 실행마다 한 행을 넣으며 최신은
 * {@code created_at DESC, id DESC} 첫 행이다 - 같은 초에 두 행이 들어가도 순서가 흔들리지
 * 않도록 id 를 두 번째 기준으로 둔다.
 *
 * <p>DDL 은 {@code resources/db/import-source-snapshot-mysql.sql} 하나가 정본이다.
 * local·dev·test 는 {@code spring.sql.init} 이 기동 시 적용하고, prod 는 런북으로 사람이 적용한다.
 */
@Component
@RequiredArgsConstructor
public class JdbcImportSourceSnapshotAdapter implements ImportSourceSnapshotPort {

    private static final String FIND_LATEST_SQL = """
        SELECT source, area_code, file_id, file_name, content_length,
               source_modified_max, imported_count, run_started_at
          FROM import_source_snapshot
         WHERE source = ?
           AND area_code = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1
        """;

    private static final String INSERT_SQL = """
        INSERT INTO import_source_snapshot
            (source, area_code, file_id, file_name, content_length,
             source_modified_max, imported_count, run_started_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Optional<ImportSourceSnapshot> findLatest(PlaceSourceType source, String areaCode) {
        List<ImportSourceSnapshot> rows =
            jdbcTemplate.query(FIND_LATEST_SQL, this::mapRow, source.name(), areaCode);
        return rows.stream().findFirst();
    }

    @Override
    public void record(ImportSourceSnapshot snapshot) {
        jdbcTemplate.update(INSERT_SQL,
            snapshot.source().name(), snapshot.areaCode(), snapshot.fileId(), snapshot.fileName(),
            snapshot.contentLength(), toTimestamp(snapshot.sourceModifiedMax()), snapshot.importedCount(),
            toTimestamp(snapshot.runStartedAt()));
    }

    private ImportSourceSnapshot mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ImportSourceSnapshot(
            PlaceSourceType.valueOf(rs.getString("source")), rs.getString("area_code"), rs.getString("file_id"),
            rs.getString("file_name"), rs.getLong("content_length"), toLocalDateTime(rs.getTimestamp("source_modified_max")),
            rs.getInt("imported_count"), toLocalDateTime(rs.getTimestamp("run_started_at")));
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private Timestamp toTimestamp(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }
}
