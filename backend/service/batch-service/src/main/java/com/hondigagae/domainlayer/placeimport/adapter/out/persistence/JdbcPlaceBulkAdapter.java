package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
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
 * place 테이블 대량 upsert 어댑터.
 *
 * <p>테이블 스키마의 원천은 tour-service의 PlaceEntity(JPA)다 — 이 배치는 스키마를 만들지 않고
 * upsert만 수행하므로, 로컬에서는 tour-service를 먼저 한 번 기동해 테이블을 생성해야 한다.
 *
 * <p><b>id 전략</b>: id = content_id (원천 식별자 기반 결정적 PK).
 * batch-service는 persistence-core(Snowflake)에 의존하지 않으므로, 랜덤/시간 기반 임시 ID 대신
 * 원천 식별자를 그대로 PK로 써서 재실행 멱등성을 보장한다. TourAPI contentid는 전역 유일이라 충돌이 없다.
 * TODO: 서비스 전체 ID 정책(Snowflake) 일원화 여부 결정 — 도입 시 persistence-core 의존 추가 후
 *       INSERT 시에만 Snowflake 발급으로 전환한다 (content_id UK가 있어 전환해도 멱등성은 유지됨).
 *
 * <p>pet_available / pet_allowance_type은 별도 반려동물 마킹 잡의 소유 컬럼이라
 * INSERT 기본값만 넣고 UPDATE 절에서는 건드리지 않는다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceBulkAdapter implements PlaceBulkPort {

    private static final int BATCH_SIZE = 500;

    private static final String UPSERT_SQL = """
        INSERT INTO place (
            id,
            content_id,
            content_type_id,
            title,
            addr1,
            addr2,
            zipcode,
            area_code,
            sigungu_code,
            ldong_regn_cd,
            ldong_signgu_cd,
            cat1,
            cat2,
            cat3,
            lcls_systm1,
            lcls_systm2,
            lcls_systm3,
            lat,
            lng,
            mlevel,
            first_image,
            first_image2,
            cpyrht_div_cd,
            tel,
            pet_available,
            pet_allowance_type,
            source_created_at,
            source_modified_at,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, 'UNKNOWN', ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            content_type_id = VALUES(content_type_id),
            title = VALUES(title),
            addr1 = VALUES(addr1),
            addr2 = VALUES(addr2),
            zipcode = VALUES(zipcode),
            area_code = VALUES(area_code),
            sigungu_code = VALUES(sigungu_code),
            ldong_regn_cd = VALUES(ldong_regn_cd),
            ldong_signgu_cd = VALUES(ldong_signgu_cd),
            cat1 = VALUES(cat1),
            cat2 = VALUES(cat2),
            cat3 = VALUES(cat3),
            lcls_systm1 = VALUES(lcls_systm1),
            lcls_systm2 = VALUES(lcls_systm2),
            lcls_systm3 = VALUES(lcls_systm3),
            lat = VALUES(lat),
            lng = VALUES(lng),
            mlevel = VALUES(mlevel),
            first_image = VALUES(first_image),
            first_image2 = VALUES(first_image2),
            cpyrht_div_cd = VALUES(cpyrht_div_cd),
            tel = VALUES(tel),
            source_created_at = VALUES(source_created_at),
            source_modified_at = VALUES(source_modified_at),
            synced_at = VALUES(synced_at),
            updated_at = NOW()
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void upsertAll(List<ImportedPlace> places) {
        LocalDateTime syncedAt = LocalDateTime.now();

        for (int start = 0; start < places.size(); start += BATCH_SIZE) {
            int end = Math.min(start + BATCH_SIZE, places.size());
            List<ImportedPlace> chunk = places.subList(start, end);

            jdbcTemplate.batchUpdate(UPSERT_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int i) throws SQLException {
                    ImportedPlace place = chunk.get(i);
                    int index = 1;
                    ps.setLong(index++, place.contentId());
                    ps.setLong(index++, place.contentId());
                    ps.setString(index++, place.contentTypeId());
                    ps.setString(index++, place.title());
                    ps.setString(index++, place.addr1());
                    ps.setString(index++, place.addr2());
                    ps.setString(index++, place.zipcode());
                    ps.setString(index++, place.areaCode());
                    ps.setString(index++, place.sigunguCode());
                    ps.setString(index++, place.ldongRegnCd());
                    ps.setString(index++, place.ldongSignguCd());
                    ps.setString(index++, place.cat1());
                    ps.setString(index++, place.cat2());
                    ps.setString(index++, place.cat3());
                    ps.setString(index++, place.lclsSystm1());
                    ps.setString(index++, place.lclsSystm2());
                    ps.setString(index++, place.lclsSystm3());
                    setNullableDecimal(ps, index++, place.lat());
                    setNullableDecimal(ps, index++, place.lng());
                    setNullableInt(ps, index++, place.mlevel());
                    ps.setString(index++, place.firstImage());
                    ps.setString(index++, place.firstImage2());
                    ps.setString(index++, place.cpyrhtDivCd());
                    ps.setString(index++, place.tel());
                    setNullableDateTime(ps, index++, place.sourceCreatedAt());
                    setNullableDateTime(ps, index++, place.sourceModifiedAt());
                    ps.setTimestamp(index, Timestamp.valueOf(syncedAt));
                }

                @Override
                public int getBatchSize() {
                    return chunk.size();
                }
            });
        }
    }

    private void setNullableDecimal(PreparedStatement ps, int index, java.math.BigDecimal value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.DECIMAL);
            return;
        }
        ps.setBigDecimal(index, value);
    }

    private void setNullableInt(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.INTEGER);
            return;
        }
        ps.setInt(index, value);
    }

    private void setNullableDateTime(PreparedStatement ps, int index, LocalDateTime value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.TIMESTAMP);
            return;
        }
        ps.setTimestamp(index, Timestamp.valueOf(value));
    }
}
