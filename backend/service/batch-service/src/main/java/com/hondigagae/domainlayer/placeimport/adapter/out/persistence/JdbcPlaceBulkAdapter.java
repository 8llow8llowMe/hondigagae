package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPetRestaurant;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
 *
 * <p><b>{@code area_code} / {@code sigungu_code} 는 원천 필드가 아니라 적재 범위 키다 (#726).</b>
 * SQL 만 보면 원천이 준 값을 그대로 넣는 컬럼처럼 읽히지만 그렇지 않다. TourAPI 가 법정동 체계로
 * 이관하면서 제주 콘텐츠의 {@code areacode}/{@code sigungucode} 를 빈 문자열로 비웠고, 그래서
 * {@code TourApiPlaceCatalogAdapter.toImportedPlace} 가 <b>원천 값이 비었을 때 요청 scope 의
 * areaCode 로 스탬프해서</b> 올린다(시군구는 {@code lDongSignguCd} 환산). 여기 들어오는 값은 그
 * 스탬프를 거친 값이다 — 비워 두거나 원천 그대로 두면 아래 셋이 전부 조용히 어긋난다.
 *
 * <ul>
 *   <li>delist — {@code JdbcPlaceDelistAdapter} 가 {@code (source, area_code)} 로 범위를 자른다.
 *       비어 있으면 이번 실행이 건드린 행을 stale 로 되짚지 못한다</li>
 *   <li>중복 병합 — {@code JdbcPlaceMergeAdapter} 가 같은 area_code 안에서만 후보를 찾는다</li>
 *   <li>공개 조회 — tour-service 의 {@code GET /api/v1/places?areaCode=39} 가 이 값으로 거른다.
 *       비어 있으면 적재는 성공했는데 화면에 한 건도 보이지 않는다</li>
 * </ul>
 *
 * <p>반대로 {@code ldong_regn_cd}/{@code ldong_signgu_cd} 는 원천 값 그대로다 — 환산의 근거를
 * 지워 버리면 나중에 매핑이 맞았는지 되짚을 수 없다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceBulkAdapter implements PlaceBulkPort {

    private static final int BATCH_SIZE = 500;

    /**
     * 관광 API 장소 upsert.
     *
     * <p><b>모르는 값은 넣지 않는다.</b> 관광 API 는 실내외를 말해 주지 않으므로 indoor / outdoor 를
     * INSERT 컬럼 목록에서 아예 빼 NULL 로 둔다 — {@link #MFDS_UPSERT_SQL} 과 같은 규칙이다.
     * 리터럴 {@code false} 를 박으면 "모른다" 와 "실외다" 가 같은 값이 되고, tour-service 의
     * {@code PlaceEntity} 가 이 컬럼을 {@code Boolean} wrapper 로 둔 이유("false 로 뭉개면 관광 API
     * 장소가 전부 실외로 잘못 표시된다")가
     * 무너진다. 실제로 그 상태였고 결과가 둘이었다 — 비 오는 날 실내 대안에서 관광 API 장소가 전부
     * 배제되고, 병합의 {@code COALESCE(survivor.indoor, absorbed.indoor)} 가 survivor 값이 절대
     * NULL 이 아니라 <b>영구 no-op</b> 이 돼 문화정보원이 아는 실내외를 병합할 때마다 버렸다 (#753).
     *
     * <p>UPDATE 절에서도 건드리지 않는다. 병합 잡이 다른 원천에서 옮겨 채워 둔 값을 재적재 때마다
     * 도로 지워 버리면 안 된다.
     *
     * <p><b>같은 INSERT 안에 정반대 규칙이 하나 있다</b> — {@code area_code} 는 원천이 비워 보내도
     * 우리가 채워 넣는다. 그쪽은 사실 데이터가 아니라 <b>적재 범위 키</b>라서 NULL 이면 delist·병합·
     * 공개 조회가 동시에 눈이 먼다. "사실은 모르면 비우고, 범위 키는 모르면 채운다" 가 두 규칙의 경계다.
     */
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
            pet_only,
            allowed_pet_size,
            source_created_at,
            source_modified_at,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, 'TOUR_API', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  false, 'UNKNOWN', false, 'UNKNOWN', ?, ?, ?, NOW(), NOW())
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
            delisted_at = NULL,
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
            max_pet_weight_kg,
            pet_restriction,
            pet_extra_fee,
            source_modified_at,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, 'CULTURE_PORTAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
            max_pet_weight_kg = VALUES(max_pet_weight_kg),
            pet_restriction = VALUES(pet_restriction),
            pet_extra_fee = VALUES(pet_extra_fee),
            source_modified_at = VALUES(source_modified_at),
            synced_at = VALUES(synced_at),
            delisted_at = NULL,
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
            weekly_hours_spec,
            open24,
            rest_date,
            parking,
            raw_json,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            use_time = VALUES(use_time),
            weekly_hours_spec = VALUES(weekly_hours_spec),
            open24 = VALUES(open24),
            rest_date = VALUES(rest_date),
            parking = VALUES(parking),
            raw_json = VALUES(raw_json),
            synced_at = VALUES(synced_at),
            updated_at = NOW()
        """;

    /**
     * 식약처 등록 업소 upsert.
     *
     * <p><b>모르는 값은 넣지 않는다.</b> indoor / outdoor 는 INSERT 컬럼 목록에서 아예 빼 NULL 로 두고,
     * allowed_pet_size 는 UNKNOWN 으로 넣는다. 이 원천은 "동반 가능하다"는 사실만 알려줄 뿐
     * 실내인지 크기 제한이 있는지는 말해 주지 않는다.
     *
     * <p>UPDATE 절에서 indoor / outdoor / allowed_pet_size 를 건드리지 않는 것도 같은 이유다 —
     * 병합 잡이 다른 원천에서 옮겨 채워 둔 값을 재실행 때마다 도로 지워 버리면 안 된다.
     */
    private static final String MFDS_UPSERT_SQL = """
        INSERT INTO place (
            id,
            source,
            source_key,
            source_category,
            content_type_id,
            title,
            addr1,
            area_code,
            sigungu_code,
            lat,
            lng,
            pet_available,
            pet_allowance_type,
            pet_only,
            allowed_pet_size,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, 'MFDS', ?, ?, ?, ?, ?, ?, ?, ?, ?, true, 'ALLOWED', false, 'UNKNOWN', ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            source_category = VALUES(source_category),
            content_type_id = VALUES(content_type_id),
            title = VALUES(title),
            addr1 = VALUES(addr1),
            area_code = VALUES(area_code),
            sigungu_code = VALUES(sigungu_code),
            lat = VALUES(lat),
            lng = VALUES(lng),
            pet_available = VALUES(pet_available),
            pet_allowance_type = VALUES(pet_allowance_type),
            synced_at = VALUES(synced_at),
            delisted_at = NULL,
            updated_at = NOW()
        """;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

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
                    setNullableInt(ps, index++, facility.maxPetWeightKg());
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

    @Override
    public void upsertPetRestaurants(List<ImportedPetRestaurant> restaurants) {
        LocalDateTime syncedAt = LocalDateTime.now();

        for (int start = 0; start < restaurants.size(); start += BATCH_SIZE) {
            int end = Math.min(start + BATCH_SIZE, restaurants.size());
            List<ImportedPetRestaurant> chunk = restaurants.subList(start, end);

            jdbcTemplate.batchUpdate(MFDS_UPSERT_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int i) throws SQLException {
                    ImportedPetRestaurant restaurant = chunk.get(i);
                    int index = 1;
                    ps.setLong(index++, restaurant.placeId());
                    ps.setString(index++, restaurant.sourceKey());
                    ps.setString(index++, restaurant.businessType());
                    ps.setString(index++, ImportedPetRestaurant.CONTENT_TYPE_RESTAURANT);
                    ps.setString(index++, restaurant.name());
                    ps.setString(index++, restaurant.address());
                    ps.setString(index++, restaurant.areaCode());
                    ps.setString(index++, restaurant.sigunguCode());
                    setNullableDecimal(ps, index++, restaurant.lat());
                    setNullableDecimal(ps, index++, restaurant.lng());
                    ps.setTimestamp(index, Timestamp.valueOf(syncedAt));
                }

                @Override
                public int getBatchSize() {
                    return chunk.size();
                }
            });
        }
    }

    /** 지오코딩 실패 업소는 upsert 를 못 타므로 synced_at 만 따로 만진다. 행이 아직 없으면 무시된다. */
    private static final String MFDS_TOUCH_SYNCED_SQL = """
        UPDATE place
           SET synced_at = ?,
               updated_at = NOW()
         WHERE source = 'MFDS'
           AND source_key = ?
        """;

    @Override
    public void touchPetRestaurantsSyncedAt(List<String> sourceKeys) {
        if (sourceKeys.isEmpty()) {
            return;
        }
        LocalDateTime syncedAt = LocalDateTime.now();

        for (int start = 0; start < sourceKeys.size(); start += BATCH_SIZE) {
            List<String> chunk = sourceKeys.subList(start, Math.min(start + BATCH_SIZE, sourceKeys.size()));
            jdbcTemplate.batchUpdate(MFDS_TOUCH_SYNCED_SQL, new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int i) throws SQLException {
                    ps.setTimestamp(1, Timestamp.valueOf(syncedAt));
                    ps.setString(2, chunk.get(i));
                }

                @Override
                public int getBatchSize() {
                    return chunk.size();
                }
            });
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
                ps.setString(index++, facility.weeklyHoursSpec());
                ps.setBoolean(index++, facility.open24());
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

    /**
     * raw_json 은 MySQL JSON 컬럼이라 invalid JSON 은 INSERT 자체가 거부된다. 수제 이스케이프는
     * 원문에 역슬래시·개행이 오면 깨지므로 반드시 ObjectMapper 로 직렬화한다.
     */
    private String toRawJson(ImportedCultureFacility facility) {
        if (facility.admissionFee() == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(Map.of("admissionFee", facility.admissionFee()));
        } catch (JsonProcessingException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.INTRO_JSON_SERIALIZE_FAILED,
                exception, facility.sourceKey());
        }
    }

    private void setNullableInt(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.INTEGER);
            return;
        }
        ps.setInt(index, value);
    }

    private void setNullableDecimal(PreparedStatement ps, int index, java.math.BigDecimal value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.DECIMAL);
            return;
        }
        ps.setBigDecimal(index, value);
    }

    private void setNullableDateTime(PreparedStatement ps, int index, LocalDateTime value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.TIMESTAMP);
            return;
        }
        ps.setTimestamp(index, Timestamp.valueOf(value));
    }
}
