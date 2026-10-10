package com.hondigagae.domainlayer.walkcourseimport.adapter.out.persistence;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSnapshotPort;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseSnapshot;
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
 * 올레 CSV 원천 스냅샷 저장소.
 *
 * <p>문화정보원과 같은 {@code import_source_snapshot} 테이블을 쓴다. {@code source} 와
 * {@code area_code} 로 가른다. append-only 이며 최신은 {@code created_at DESC, id DESC} 첫 행이다.
 */
@Component
@RequiredArgsConstructor
public class JdbcOlleCourseSnapshotAdapter implements OlleCourseSnapshotPort {

    private static final String FIND_LATEST_SQL = """
        SELECT file_id, file_name, content_length, source_modified_max, imported_count, run_started_at
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
    public Optional<OlleCourseSnapshot> findLatest() {
        List<OlleCourseSnapshot> rows = jdbcTemplate.query(
            FIND_LATEST_SQL, this::mapRow, OlleCourseSnapshot.SOURCE, OlleCourseSnapshot.AREA_CODE);
        return rows.stream().findFirst();
    }

    @Override
    public void record(OlleCourseSnapshot snapshot) {
        jdbcTemplate.update(INSERT_SQL,
            OlleCourseSnapshot.SOURCE, OlleCourseSnapshot.AREA_CODE, snapshot.fileId(), snapshot.fileName(),
            snapshot.contentLength(), toTimestamp(snapshot.sourceModifiedMax()), snapshot.importedCount(),
            toTimestamp(snapshot.runStartedAt()));
    }

    private OlleCourseSnapshot mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new OlleCourseSnapshot(
            rs.getString("file_id"), rs.getString("file_name"), rs.getLong("content_length"),
            toLocalDateTime(rs.getTimestamp("source_modified_max")), rs.getInt("imported_count"),
            toLocalDateTime(rs.getTimestamp("run_started_at")));
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private Timestamp toTimestamp(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }
}
