package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceOverrideCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceOverrideTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.OverridablePlace;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 장소 보정 어댑터 (#1434). 읽기 한 번 · 배치 쓰기 한 번이다. 적용 판정(id · 제목)과 지금 값 · 보정 값 합치기는 도메인
 * ({@code PlaceOverride.appliesTo} · {@code applyTo}) 한 곳이 하고, 이 어댑터는 판정하지 않는다.
 *
 * <p><b>SQL 에서 값을 합치지 않는다.</b> 다섯 칸을 프로세서가 합친 결과 그대로 평범한 파라미터로 쓴다. {@code indoor} · {@code outdoor} ·
 * {@code pet_available} 은 MySQL 에서 Hibernate 가 만든 {@code BIT(1)} 인데, {@code col = COALESCE(?, col)} 로 쓰면 Connector/J 가
 * 보내는 정수와 {@code BIT} 의 형 병합이 문자열이 되어 {@code '0'} 을 {@code BIT(1)} 에 넣으려다 {@code ER_DATA_TOO_LONG}(엄격 모드)로 실패하거나
 * 1 로 포화될 수 있다. {@code IF} · {@code CASE} 도 같은 병합을 거친다. H2 의 {@code BOOLEAN} 으로는 이 차이를 볼 수 없어 모양으로 막는다.
 * 바인딩은 적재 어댑터({@code JdbcPlaceBulkAdapter})와 같다 — {@code setBoolean} / {@code setNull(BOOLEAN)}.
 *
 * <p><b>제목을 한 번 더 건다</b>({@code AND title = ?}). 프로세서가 읽고 판정한 뒤 그사이 원천 재적재가 제목을 바꿨다면 쓰지 않는다.
 * 읽은 뒤 다른 경로가 같은 행의 다른 칸을 바꿨다면 읽은 값으로 덮는다 — 같은 잡 안의 스텝은 순서대로 돌고, 보정 스텝은 그 잡의 마지막이다.
 *
 * <p>원천 · 노출 여부는 보지 않는다 — 보정은 id 로 행 하나를 가리킨다. SQL 은 MySQL 과 H2(MODE=MySQL) 양쪽에서 도는 모양만 쓴다
 * ({@code JdbcPlaceOverrideAdapterTest}).
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceOverrideAdapter implements PlaceOverrideCommandPort {

    private static final String SELECT_TARGETS_SQL_TEMPLATE = """
        SELECT id, source, title, indoor, outdoor, pet_allowance_type, allowed_pet_size, pet_available
          FROM place
         WHERE id IN (%s)
        """;

    private static final String UPDATE_SQL = """
        UPDATE place
           SET indoor = ?,
               outdoor = ?,
               pet_allowance_type = ?,
               allowed_pet_size = ?,
               pet_available = ?,
               updated_at = NOW()
         WHERE id = ?
           AND title = ?
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<PlaceOverrideTargetQueryResult> findTargets(Collection<Long> placeIds) {
        // 빈 목록이면 IN () 가 문법 오류다. 호출 전에 접는다.
        if (placeIds == null || placeIds.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(", ", Collections.nCopies(placeIds.size(), "?"));
        return jdbcTemplate.query(SELECT_TARGETS_SQL_TEMPLATE.formatted(placeholders), this::toTarget, placeIds.toArray());
    }

    @Override
    public int applyOverrides(List<OverridablePlace> rows) {
        if (rows.isEmpty()) {
            return 0;
        }
        int[] updated = jdbcTemplate.batchUpdate(UPDATE_SQL, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                OverridablePlace row = rows.get(i);
                setNullableBoolean(ps, 1, row.indoor());
                setNullableBoolean(ps, 2, row.outdoor());
                ps.setString(3, row.petAllowanceType());
                ps.setString(4, row.allowedPetSize());
                ps.setBoolean(5, row.petAvailable());
                ps.setLong(6, row.placeId());
                ps.setString(7, row.title());
            }

            @Override
            public int getBatchSize() {
                return rows.size();
            }
        });

        int total = 0;
        for (int count : updated) {
            total += Math.max(count, 0);
        }
        return total;
    }

    private PlaceOverrideTargetQueryResult toTarget(ResultSet rs, int rowNum) throws SQLException {
        return new PlaceOverrideTargetQueryResult(rs.getLong("id"), rs.getString("source"), rs.getString("title"),
            nullableBoolean(rs, "indoor"), nullableBoolean(rs, "outdoor"), rs.getString("pet_allowance_type"), rs.getString("allowed_pet_size"),
            rs.getBoolean("pet_available"));
    }

    /** NULL 은 "모름" 이다 — {@code getBoolean} 은 NULL 을 false 로 읽어 실외로 뭉갠다(#753). */
    private static Boolean nullableBoolean(ResultSet rs, String column) throws SQLException {
        boolean value = rs.getBoolean(column);
        return rs.wasNull() ? null : value;
    }

    private static void setNullableBoolean(PreparedStatement ps, int index, Boolean value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.BOOLEAN);
            return;
        }
        ps.setBoolean(index, value);
    }
}
