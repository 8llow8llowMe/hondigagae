package com.hondigagae.domainlayer.congestionimport.adapter.out.persistence;

import com.hondigagae.domainlayer.congestionimport.application.port.out.PlaceNameLinkBulkPort;
import com.hondigagae.domainlayer.congestionimport.application.port.out.query.PlaceNameCandidateQueryResult;
import com.hondigagae.domainlayer.congestionimport.domain.model.ResolvedPlaceNameLink;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * place_name_link 조회/대량 upsert.
 *
 * <p>테이블 스키마의 원천은 tour-service 의 {@code PlaceNameLinkEntity}(JPA)다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceNameLinkAdapter implements PlaceNameLinkBulkPort {

    private static final int BATCH_SIZE = 500;

    /**
     * 병합으로 사라진 행과 delist 된 행은 매칭 대상이 아니다. delist 행이 완전일치를 선점하면
     * 살아있는 장소가 부분일치 기회를 뺏겨 UNMATCHED 가 된다.
     */
    private static final String SELECT_PLACES_SQL = """
        SELECT id, title
        FROM place
        WHERE merged_into_id IS NULL
          AND delisted_at IS NULL
          AND (? IS NULL OR area_code = ?)
        """;

    private static final String UPSERT_SQL = """
        INSERT INTO place_name_link (
            id, source_type, area_cd, signgu_cd, tats_nm, place_id, match_type, synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            place_id = VALUES(place_id),
            match_type = VALUES(match_type),
            synced_at = VALUES(synced_at),
            updated_at = NOW()
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<PlaceNameCandidateQueryResult> findPlaceNames(String areaCode) {
        return jdbcTemplate.query(SELECT_PLACES_SQL,
            (resultSet, rowNum) -> new PlaceNameCandidateQueryResult(
                resultSet.getLong("id"), resultSet.getString("title")),
            areaCode, areaCode);
    }

    @Override
    public int upsertAll(List<ResolvedPlaceNameLink> links) {
        if (links == null || links.isEmpty()) {
            return 0;
        }
        LocalDateTime syncedAt = LocalDateTime.now();
        int total = 0;

        for (int start = 0; start < links.size(); start += BATCH_SIZE) {
            List<ResolvedPlaceNameLink> chunk = links.subList(start, Math.min(start + BATCH_SIZE, links.size()));
            int[] affected = jdbcTemplate.batchUpdate(UPSERT_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement statement, int index) throws SQLException {
                    ResolvedPlaceNameLink link = chunk.get(index);
                    statement.setLong(1, link.id());
                    statement.setString(2, link.sourceType());
                    statement.setString(3, link.areaCd());
                    statement.setString(4, link.signguCd());
                    statement.setString(5, link.tatsNm());
                    // 매칭 실패도 저장한다. 실패를 행 없이 버리면 커버리지를 알 수 없다.
                    if (link.placeId() == null) {
                        statement.setNull(6, Types.BIGINT);
                    } else {
                        statement.setLong(6, link.placeId());
                    }
                    statement.setString(7, link.matchType());
                    statement.setTimestamp(8, Timestamp.valueOf(syncedAt));
                }

                @Override
                public int getBatchSize() {
                    return chunk.size();
                }
            });
            total += affected.length;
        }
        return total;
    }
}
