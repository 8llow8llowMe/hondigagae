package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetAllowanceCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetAllowanceEvidenceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ReflectedPetAllowance;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * TourAPI 장소의 동반 가능 여부 · 크기 제한 재계산 어댑터 (#886).
 *
 * <p><b>이 두 컬럼의 TourAPI 행 소유자는 이 어댑터다.</b> TourAPI 적재({@code JdbcPlaceBulkAdapter.UPSERT_SQL})는 INSERT
 * 리터럴 {@code 'UNKNOWN'} 만 넣고 UPDATE 절에 두 컬럼을 두지 않으며, 병합은 두 컬럼을 옮기지 않는다
 * ({@code JdbcPlaceBulkAdapterSqlTest} 가 둘 다 고정한다). 그래서 재적재 · 재병합이 여기서 채운 값을 지우지 않는다.
 *
 * <p>SQL 은 MySQL 과 H2(MODE=MySQL) 양쪽에서 도는 모양만 쓴다 — 이유는 {@code PlacePetAllowanceReflectProcessor}.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlacePetAllowanceAdapter implements PlacePetAllowanceCommandPort {

    /**
     * 대상 행 × (동반 정보 0..1) × (흡수 행 0..N). 흡수 행이 여럿이면 대상이 여러 줄로 나오므로 {@code p.id} 순으로 읽어 묶는다.
     *
     * <p>delist 된 흡수 행은 근거에서 뺀다 — 원천이 더는 내지 않는 장소의 동반 여부다. 재등장하면 적재가
     * {@code delisted_at} 을 비우고 다음 실행에서 다시 근거가 된다.
     */
    private static final String SELECT_EVIDENCES_SQL = """
        SELECT p.id,
               p.pet_allowance_type,
               p.allowed_pet_size,
               ppi.allowance_scope AS pet_info_scope,
               ppi.allowed_pet_size AS pet_info_size,
               absorbed.pet_allowance_type AS absorbed_allowance,
               absorbed.allowed_pet_size AS absorbed_size
          FROM place p
          LEFT JOIN place_pet_info ppi ON ppi.place_id = p.id
          LEFT JOIN place absorbed ON absorbed.merged_into_id = p.id AND absorbed.delisted_at IS NULL
         WHERE p.source = 'TOUR_API'
           AND p.merged_into_id IS NULL
           AND p.delisted_at IS NULL
         ORDER BY p.id
        """;

    /** 대상 조건을 한 번 더 건다 — 읽은 뒤 그사이 병합 · delist 된 행은 이제 대상이 아니다. */
    private static final String UPDATE_SQL = """
        UPDATE place
           SET pet_allowance_type = ?,
               allowed_pet_size = ?,
               updated_at = NOW()
         WHERE id = ?
           AND source = 'TOUR_API'
           AND merged_into_id IS NULL
           AND delisted_at IS NULL
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<PlacePetAllowanceEvidenceQueryResult> findTourApiEvidences() {
        return jdbcTemplate.query(SELECT_EVIDENCES_SQL, this::groupByPlace);
    }

    @Override
    public int updatePetAllowances(List<ReflectedPetAllowance> reflections) {
        int[] updated = jdbcTemplate.batchUpdate(UPDATE_SQL, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                ReflectedPetAllowance reflection = reflections.get(i);
                ps.setString(1, reflection.allowance().name());
                ps.setString(2, reflection.size().name());
                ps.setLong(3, reflection.placeId());
            }

            @Override
            public int getBatchSize() {
                return reflections.size();
            }
        });

        int total = 0;
        for (int count : updated) {
            total += Math.max(count, 0);
        }
        return total;
    }

    private List<PlacePetAllowanceEvidenceQueryResult> groupByPlace(ResultSet rs) throws SQLException {
        List<PlacePetAllowanceEvidenceQueryResult> evidences = new ArrayList<>();
        PlaceRows current = null;
        while (rs.next()) {
            long placeId = rs.getLong("id");
            if (current == null || current.placeId != placeId) {
                if (current != null) {
                    evidences.add(current.toQueryResult());
                }
                current = new PlaceRows(placeId, rs.getString("pet_allowance_type"), rs.getString("allowed_pet_size"),
                    rs.getString("pet_info_scope"), rs.getString("pet_info_size"));
            }
            current.addAbsorbed(rs.getString("absorbed_allowance"), rs.getString("absorbed_size"));
        }
        if (current != null) {
            evidences.add(current.toQueryResult());
        }
        return evidences;
    }

    /** 한 대상의 여러 줄(흡수 행마다 한 줄)을 모으는 임시 그릇. */
    private static final class PlaceRows {

        private final long placeId;
        private final String currentAllowance;
        private final String currentSize;
        private final String petInfoScope;
        private final String petInfoSize;
        private final List<String> absorbedAllowances = new ArrayList<>();
        private final List<String> absorbedSizes = new ArrayList<>();

        private PlaceRows(long placeId, String currentAllowance, String currentSize, String petInfoScope, String petInfoSize) {
            this.placeId = placeId;
            this.currentAllowance = currentAllowance;
            this.currentSize = currentSize;
            this.petInfoScope = petInfoScope;
            this.petInfoSize = petInfoSize;
        }

        /** 흡수 행이 없으면 LEFT JOIN 이 두 칸 모두 NULL 인 줄 하나를 준다 — 그 줄은 근거가 아니다. */
        private void addAbsorbed(String allowance, String size) {
            if (allowance != null) {
                absorbedAllowances.add(allowance);
            }
            if (size != null) {
                absorbedSizes.add(size);
            }
        }

        private PlacePetAllowanceEvidenceQueryResult toQueryResult() {
            return new PlacePetAllowanceEvidenceQueryResult(placeId, currentAllowance, currentSize, petInfoScope, petInfoSize,
                absorbedAllowances, absorbedSizes);
        }
    }
}
