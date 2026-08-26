package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceMergePort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceMergeCandidateQueryResult;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 중복 병합 어댑터.
 *
 * <p>병합된 행은 지우지 않고 {@code merged_into_id} 만 채운다. 원천을 재적재하면 그 행이 다시 살아나기 때문에,
 * 물리 삭제하면 매번 되살아났다 지워지는 일이 반복된다. 조회는 {@code merged_into_id is null} 로 거른다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceMergeAdapter implements PlaceMergePort {

    private static final String SELECT_CANDIDATES_SQL = """
        SELECT id, source, title, lat, lng
          FROM place
         WHERE merged_into_id IS NULL
           AND lat IS NOT NULL
           AND lng IS NOT NULL
           AND (? IS NULL OR area_code = ?)
        """;

    private static final String MARK_MERGED_SQL = """
        UPDATE place
           SET merged_into_id = ?,
               updated_at = NOW()
         WHERE id = ?
           AND merged_into_id IS NULL
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<PlaceMergeCandidateQueryResult> findMergeCandidates(String areaCode) {
        return jdbcTemplate.query(SELECT_CANDIDATES_SQL,
            (rs, rowNum) -> new PlaceMergeCandidateQueryResult(
                rs.getLong("id"),
                rs.getString("source"),
                rs.getString("title"),
                rs.getBigDecimal("lat"),
                rs.getBigDecimal("lng")),
            areaCode, areaCode);
    }

    @Override
    public int markMerged(List<long[]> mergePairs) {
        int[] updated = jdbcTemplate.batchUpdate(MARK_MERGED_SQL, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                long[] pair = mergePairs.get(i);
                ps.setLong(1, pair[1]);
                ps.setLong(2, pair[0]);
            }

            @Override
            public int getBatchSize() {
                return mergePairs.size();
            }
        });

        int total = 0;
        for (int count : updated) {
            total += Math.max(count, 0);
        }
        return total;
    }
}
