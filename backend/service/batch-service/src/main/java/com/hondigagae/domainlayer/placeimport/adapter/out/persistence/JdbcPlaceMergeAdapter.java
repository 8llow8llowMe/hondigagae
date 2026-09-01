package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceMergeCommandPort;
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
 *
 * <p><b>죽기 전에 값을 넘긴다.</b> 흡수되는 행에만 있는 정보(실내외·크기 제한 등)를 그냥 두면 병합이 데이터를 깎는다.
 * 제주 실측에서 병합 대상 11곳 전부가 크기 제한 정보를, 2곳이 실내 정보를 잃었다.
 * 그래서 살아남는 행의 빈 칸에 한해 흡수되는 행의 값을 채운 뒤에 병합 표시를 한다.
 * 이미 값이 있는 칸은 건드리지 않는다 — 관광 API 값이 더 정확하다고 보기 때문이다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceMergeAdapter implements PlaceMergeCommandPort {

    private static final String SELECT_CANDIDATES_SQL = """
        SELECT id, source, title, lat, lng
          FROM place
         WHERE merged_into_id IS NULL
           AND delisted_at IS NULL
           AND lat IS NOT NULL
           AND lng IS NOT NULL
           AND (? IS NULL OR area_code = ?)
        """;

    /**
     * 살아남는 행(survivor)의 빈 칸을 흡수되는 행(absorbed)의 값으로 채운다.
     * COALESCE 로 survivor 값을 우선하므로 이미 채워진 칸은 그대로 둔다.
     */
    private static final String MERGE_FIELDS_SQL = """
        UPDATE place survivor
          JOIN place absorbed ON absorbed.id = ?
           SET survivor.indoor = COALESCE(survivor.indoor, absorbed.indoor),
               survivor.outdoor = COALESCE(survivor.outdoor, absorbed.outdoor),
               survivor.pet_restriction = COALESCE(survivor.pet_restriction, absorbed.pet_restriction),
               survivor.pet_extra_fee = COALESCE(survivor.pet_extra_fee, absorbed.pet_extra_fee),
               survivor.source_category = COALESCE(survivor.source_category, absorbed.source_category),
               survivor.homepage = COALESCE(survivor.homepage, absorbed.homepage),
               survivor.tel = COALESCE(survivor.tel, absorbed.tel),
               survivor.overview = COALESCE(survivor.overview, absorbed.overview),
               survivor.pet_only = (survivor.pet_only OR absorbed.pet_only),
               -- 크기 제한은 UNKNOWN 이 '모름'이라 빈 값과 같게 취급한다
               survivor.allowed_pet_size = CASE
                   WHEN survivor.allowed_pet_size = 'UNKNOWN' THEN absorbed.allowed_pet_size
                   ELSE survivor.allowed_pet_size
               END,
               survivor.updated_at = NOW()
         WHERE survivor.id = ?
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
        // 순서가 중요하다. 병합 표시를 먼저 하면 흡수되는 행이 조회에서 빠져 값을 옮길 수 없다.
        mergeFields(mergePairs);

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

    private void mergeFields(List<long[]> mergePairs) {
        jdbcTemplate.batchUpdate(MERGE_FIELDS_SQL, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                long[] pair = mergePairs.get(i);
                ps.setLong(1, pair[0]);
                ps.setLong(2, pair[1]);
            }

            @Override
            public int getBatchSize() {
                return mergePairs.size();
            }
        });
    }
}
