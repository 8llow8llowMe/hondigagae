package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceIntroBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceIntroTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * place_intro JDBC 벌크 어댑터 (TourAPI detailIntro2 경로).
 *
 * <p>장소 하나씩 upsert 한다 — 호출과 쓰기가 장소 단위로 번갈아 일어나고, 한 곳의 실패가
 * 다른 곳의 적재를 롤백할 이유가 없다.
 *
 * <p><b>컬럼 길이를 아는 것은 이 클래스다.</b> 값을 컬럼에 맞추는 일은 INSERT 문을 소유한 쪽에
 * 둔다 — 수집 어댑터에 두면 tour-service 의 {@code PlaceIntroEntity} 가 컬럼을 넓히거나 좁혔을 때
 * 엉뚱한 파일이 조용히 어긋난다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JdbcPlaceIntroBulkAdapter implements PlaceIntroBulkPort {

    /** tour-service {@code PlaceIntroEntity} 의 컬럼 길이. 그쪽이 바뀌면 여기도 바뀐다. */
    private static final int INFO_CENTER_MAX = 200;
    private static final int USE_TIME_MAX = 300;
    private static final int REST_DATE_MAX = 200;
    private static final int PARKING_MAX = 300;
    private static final int CHK_PET_MAX = 200;
    private static final int CHK_BABY_CARRIAGE_MAX = 100;
    private static final int CHK_CREDIT_CARD_MAX = 100;
    private static final int WEEKLY_HOURS_SPEC_MAX = 300;

    /**
     * 대상 선정. {@code source = 'TOUR_API'} 로 가둬 문화정보원 경로가 채운 행을 덮지 않는다.
     * 병합·delisted 행을 빼는 규칙은 이미지 대상 쿼리와 같다 — 화면에 안 나오는 장소에
     * 희소한 쿼터를 쓰지 않는다.
     *
     * <p>정렬은 "intro 없는 곳 먼저 → synced_at 오래된 순". MySQL 은 {@code IS NULL} 이 불리언
     * 0/1 이라 {@code DESC} 로 정렬하면 NULL(=1)이 앞에 온다. 마지막 {@code p.id} 는 동률을
     * 가르는 결정적 기준이다 — 없으면 어느 행이 상한 안에 드는지 실행마다 달라져, 왜 이 장소가
     * 빠졌는지 나중에 설명할 수 없다.
     */
    private static final String SELECT_TARGETS_SQL_TEMPLATE = """
        SELECT p.id, p.content_id, p.content_type_id
          FROM place p
          LEFT JOIN place_intro pi ON pi.place_id = p.id
         WHERE p.source = 'TOUR_API'
           AND p.content_id IS NOT NULL
           AND p.content_type_id IN (%s)
           AND p.merged_into_id IS NULL
           AND p.delisted_at IS NULL
         ORDER BY pi.synced_at IS NULL DESC, pi.synced_at ASC, p.id ASC
         LIMIT ?
        """;

    private static final String UPSERT_SQL = """
        INSERT INTO place_intro (
            id,
            place_id,
            info_center,
            use_time,
            weekly_hours_spec,
            open24,
            rest_date,
            parking,
            chk_pet,
            chk_baby_carriage,
            chk_credit_card,
            raw_json,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            info_center = VALUES(info_center),
            use_time = VALUES(use_time),
            weekly_hours_spec = VALUES(weekly_hours_spec),
            open24 = VALUES(open24),
            rest_date = VALUES(rest_date),
            parking = VALUES(parking),
            chk_pet = VALUES(chk_pet),
            chk_baby_carriage = VALUES(chk_baby_carriage),
            chk_credit_card = VALUES(chk_credit_card),
            raw_json = VALUES(raw_json),
            synced_at = NOW(),
            updated_at = NOW()
        """;

    /**
     * 원천이 intro 를 주지 않은 장소용. 행이 없으면 빈 행을 만들고, 있으면 {@code synced_at} 만
     * 민다 — 이번에 말이 없다고 이미 있는 값을 지우지 않는다. {@code open24} 는 NOT NULL 이라
     * INSERT 에서만 기본값 false 를 넣는다.
     */
    private static final String TOUCH_SYNCED_SQL = """
        INSERT INTO place_intro (
            id, place_id, open24, synced_at, created_at, updated_at
        ) VALUES (?, ?, false, NOW(), NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            synced_at = NOW(),
            updated_at = NOW()
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<PlaceIntroTargetQueryResult> findTourApiTargets(List<PlaceContentType> contentTypes, int limit) {
        // 빈 목록이면 IN () 가 문법 오류다. 호출 전에 접는다.
        if (contentTypes == null || contentTypes.isEmpty() || limit <= 0) {
            return List.of();
        }
        // enum → content_type_id 문자열 변환은 저장 표현을 아는 이쪽 책임이다.
        List<Object> arguments = new ArrayList<>(contentTypes.stream().map(PlaceContentType::getCode).toList());
        String placeholders = contentTypes.stream().map(type -> "?").collect(Collectors.joining(", "));
        arguments.add(limit);

        return jdbcTemplate.query(SELECT_TARGETS_SQL_TEMPLATE.formatted(placeholders),
            (rs, rowNum) -> new PlaceIntroTargetQueryResult(
                rs.getLong("id"), rs.getLong("content_id"), rs.getString("content_type_id")),
            arguments.toArray());
    }

    @Override
    public void upsert(long placeId, ImportedPlaceIntro intro) {
        jdbcTemplate.update(UPSERT_SQL,
            placeId,
            placeId,
            truncate(intro.infoCenter(), INFO_CENTER_MAX, "info_center"),
            truncate(intro.useTime(), USE_TIME_MAX, "use_time"),
            fittingSpec(intro.weeklyHoursSpec()),
            // open24 는 NOT NULL 이라 null 을 넘길 수 없다 — 모델이 primitive boolean 인 이유다.
            intro.open24(),
            truncate(intro.restDate(), REST_DATE_MAX, "rest_date"),
            truncate(intro.parking(), PARKING_MAX, "parking"),
            truncate(intro.chkPet(), CHK_PET_MAX, "chk_pet"),
            truncate(intro.chkBabyCarriage(), CHK_BABY_CARRIAGE_MAX, "chk_baby_carriage"),
            truncate(intro.chkCreditCard(), CHK_CREDIT_CARD_MAX, "chk_credit_card"),
            intro.rawJson());
    }

    /**
     * 컬럼 길이로 자른다. 자르지 않으면 MySQL strict 모드가 {@code Data too long} 으로 스텝
     * 전체를 죽인다 — 한 곳의 긴 안내문이 나머지 장소의 적재까지 막으면 손해가 더 크다.
     *
     * <p>경계가 서로게이트 페어 한가운데면 한 글자 더 자른다. 쪼개진 반쪽은 utf8mb4 인코딩에서
     * 물음표가 되거나 드물게 예외가 된다.
     */
    private String truncate(String value, int maxLength, String columnName) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        int end = maxLength;
        if (Character.isHighSurrogate(value.charAt(end - 1))) {
            end--;
        }
        log.debug("place_intro value truncated. column={}, length={}, max={}", columnName, value.length(), maxLength);
        return value.substring(0, end);
    }

    /**
     * spec 만은 자르지 않는다 — 잘린 spec 은 짧은 spec 이 아니라 <b>틀린</b> spec 이고, 조회의
     * {@code openNow} 를 조용히 오판하게 만든다. 컬럼을 넘길 만큼 세그먼트가 많으면 모름(null)으로 둔다.
     */
    private String fittingSpec(String spec) {
        if (spec == null || spec.isBlank()) {
            return null;
        }
        if (spec.length() > WEEKLY_HOURS_SPEC_MAX) {
            // warn 인 이유: 프로세서의 withWeeklyHoursSpec 카운터는 버리기 전 값을 세므로,
            // 여기서 버린 건이 있으면 그 로그가 실제 저장분보다 낙관적이다. 두 줄을 대조할 수 있어야 한다.
            log.warn("weekly hours spec dropped: too long for column. length={}, max={}",
                spec.length(), WEEKLY_HOURS_SPEC_MAX);
            return null;
        }
        return spec;
    }

    @Override
    public void touchSyncedAt(long placeId) {
        jdbcTemplate.update(TOUCH_SYNCED_SQL, placeId, placeId);
    }
}
