package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
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
 * <p><b>id 전략</b>: {@code PlaceIdFactory} 가 원천 식별자에서 결정적으로 만든다. 재실행해도 같은 행에 꽂힌다.
 *
 * <p><b>고유 키</b>: {@code (source, source_key)}. 원천이 둘 이상이라 content_id 만으로는 식별할 수 없다.
 *
 * <p><b>반려동물 컬럼 소유권</b>: 관광 API 적재는 pet_available / pet_allowance_type 을 INSERT 기본값만 넣고
 * UPDATE 절에서 건드리지 않는다(별도 마킹 잡의 소유 컬럼이다). 문화정보원 적재는 그 값을 원천 컬럼으로
 * 직접 갖고 있으므로 자기 행에 한해 UPDATE 에서도 갱신한다. 두 원천은 서로 다른 행이라 충돌하지 않는다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceBulkAdapter implements PlaceBulkPort {

    private static final int BATCH_SIZE = 500;

    private static final String UPSERT_SQL = """
        INSERT INTO place (
            id,
            source,
            source_key,
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
            indoor,
            outdoor,
            pet_only,
            allowed_pet_size,
            source_created_at,
            source_modified_at,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, 'TOUR_API', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  false, 'UNKNOWN', false, false, false, 'UNKNOWN', ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            content_id = VALUES(content_id),
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


    private static final String CULTURE_UPSERT_SQL = """
        INSERT INTO place (
            id,
            source,
            source_key,
            source_category,
            content_type_id,
            title,
            addr1,
            zipcode,
            area_code,
            sigungu_code,
            lat,
            lng,
            tel,
            homepage,
            overview,
            pet_available,
            pet_allowance_type,
            indoor,
            outdoor,
            pet_only,
            allowed_pet_size,
            pet_restriction,
            pet_extra_fee,
            source_modified_at,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, 'CULTURE_PORTAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            source_category = VALUES(source_category),
            content_type_id = VALUES(content_type_id),
            title = VALUES(title),
            addr1 = VALUES(addr1),
            zipcode = VALUES(zipcode),
            area_code = VALUES(area_code),
            sigungu_code = VALUES(sigungu_code),
            lat = VALUES(lat),
            lng = VALUES(lng),
            tel = VALUES(tel),
            homepage = VALUES(homepage),
            overview = VALUES(overview),
            pet_available = VALUES(pet_available),
            pet_allowance_type = VALUES(pet_allowance_type),
            indoor = VALUES(indoor),
            outdoor = VALUES(outdoor),
            pet_only = VALUES(pet_only),
            allowed_pet_size = VALUES(allowed_pet_size),
            pet_restriction = VALUES(pet_restriction),
            pet_extra_fee = VALUES(pet_extra_fee),
            source_modified_at = VALUES(source_modified_at),
            synced_at = VALUES(synced_at),
            updated_at = NOW()
        """;


    /**
     * 운영시간·휴무일·주차·입장료는 place 가 아니라 place_intro 가 갖는다.
     * 문화정보원은 이 네 값이 230곳 전부 채워져 있어 버리면 손실이 크다.
     * place_intro 의 PK 는 place_id 와 1:1 이라 place id 를 그대로 쓴다.
     */
    private static final String CULTURE_INTRO_UPSERT_SQL = """
        INSERT INTO place_intro (
            id,
            place_id,
            use_time,
            rest_date,
            parking,
            raw_json,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            use_time = VALUES(use_time),
            rest_date = VALUES(rest_date),
            parking = VALUES(parking),
            raw_json = VALUES(raw_json),
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
                    ps.setString(index++, String.valueOf(place.contentId()));
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


    @Override
    public void upsertCultureFacilities(List<ImportedCultureFacility> facilities) {
        LocalDateTime syncedAt = LocalDateTime.now();

        for (int start = 0; start < facilities.size(); start += BATCH_SIZE) {
            int end = Math.min(start + BATCH_SIZE, facilities.size());
            List<ImportedCultureFacility> chunk = facilities.subList(start, end);

            jdbcTemplate.batchUpdate(CULTURE_UPSERT_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int i) throws SQLException {
                    ImportedCultureFacility facility = chunk.get(i);
                    int index = 1;
                    ps.setLong(index++, facility.placeId());
                    ps.setString(index++, facility.sourceKey());
                    ps.setString(index++, facility.sourceCategory());
                    ps.setString(index++, facility.contentTypeId());
                    ps.setString(index++, facility.title());
                    ps.setString(index++, facility.addr1());
                    ps.setString(index++, facility.zipcode());
                    ps.setString(index++, facility.areaCode());
                    ps.setString(index++, facility.sigunguCode());
                    setNullableDecimal(ps, index++, facility.lat());
                    setNullableDecimal(ps, index++, facility.lng());
                    ps.setString(index++, facility.tel());
                    ps.setString(index++, facility.homepage());
                    ps.setString(index++, facility.overview());
                    ps.setBoolean(index++, facility.petAvailable());
                    ps.setString(index++, facility.petAllowanceType());
                    ps.setBoolean(index++, facility.indoor());
                    ps.setBoolean(index++, facility.outdoor());
                    ps.setBoolean(index++, facility.petOnly());
                    ps.setString(index++, facility.allowedPetSize());
                    ps.setString(index++, facility.petRestriction());
                    ps.setString(index++, facility.petExtraFee());
                    setNullableDateTime(ps, index++, facility.sourceModifiedAt());
                    ps.setTimestamp(index, Timestamp.valueOf(syncedAt));
                }

                @Override
                public int getBatchSize() {
                    return chunk.size();
                }
            });

            upsertCultureIntros(chunk, syncedAt);
        }
    }

    /** 입장료는 place_intro 의 정규 컬럼이 없어 raw_json 에 넣는다. */
    private void upsertCultureIntros(List<ImportedCultureFacility> chunk, LocalDateTime syncedAt) {
        jdbcTemplate.batchUpdate(CULTURE_INTRO_UPSERT_SQL, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                ImportedCultureFacility facility = chunk.get(i);
                int index = 1;
                ps.setLong(index++, facility.placeId());
                ps.setLong(index++, facility.placeId());
                ps.setString(index++, facility.useTime());
                ps.setString(index++, facility.restDate());
                ps.setString(index++, facility.parking());
                ps.setString(index++, toRawJson(facility));
                ps.setTimestamp(index, Timestamp.valueOf(syncedAt));
            }

            @Override
            public int getBatchSize() {
                return chunk.size();
            }
        });
    }

    private String toRawJson(ImportedCultureFacility facility) {
        if (facility.admissionFee() == null) {
            return null;
        }
        return "{\"admissionFee\":\"" + facility.admissionFee().replace("\"", "'") + "\"}";
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
