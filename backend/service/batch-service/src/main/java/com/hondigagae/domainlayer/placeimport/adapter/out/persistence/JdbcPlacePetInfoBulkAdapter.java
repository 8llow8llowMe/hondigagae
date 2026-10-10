package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetInfoBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetInfoTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * place_pet_info JDBC 벌크 어댑터 (반려동물 동반여행 detailPetTour2 경로, #877).
 *
 * <p>장소 하나씩 upsert 한다 — 호출과 쓰기가 장소 단위로 번갈아 일어나고, 한 곳의 실패가 다른 곳의
 * 적재를 롤백할 이유가 없다 ({@link JdbcPlaceIntroBulkAdapter} 와 같은 결).
 *
 * <p><b>컬럼 길이를 아는 것은 이 클래스다.</b> tour-service {@code PlacePetInfoEntity} 가 컬럼을
 * 바꾸면 여기도 바뀐다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JdbcPlacePetInfoBulkAdapter implements PlacePetInfoBulkPort {

    /** tour-service {@code PlacePetInfoEntity} 의 컬럼 길이. {@code etc_acmpy_info} 는 TEXT 라 자르지 않는다. */
    private static final int ACMPY_TYPE_CD_MAX = 100;
    private static final int ACMPY_PSBL_CPAM_MAX = 300;
    private static final int ACMPY_NEED_MTR_MAX = 500;
    private static final int RELA_ACDNT_RISK_MTR_MAX = 500;
    private static final int RELA_ITEM_LIST_MAX = 300;

    /**
     * 대상 선정. 규칙은 intro 대상 쿼리와 같다 — {@code source = 'TOUR_API'} 로 가두고 병합·delisted
     * 행을 뺀다. 병합에서 살아남는 쪽이 TourAPI 행이라({@code JdbcPlaceMergeAdapter}) 병합된 장소의
     * 동반 조건도 이 조건 안에서 채워진다.
     *
     * <p>정렬 "행 없는 곳 먼저 → synced_at 오래된 순 → id" 도 같다. 마지막 {@code p.id} 는 상한 안에
     * 드는 행을 실행마다 같게 만드는 결정적 기준이다.
     */
    private static final String SELECT_TARGETS_SQL_TEMPLATE = """
        SELECT p.id, p.content_id
          FROM place p
          LEFT JOIN place_pet_info ppi ON ppi.place_id = p.id
         WHERE p.source = 'TOUR_API'
           AND p.content_id IN (%s)
           AND p.merged_into_id IS NULL
           AND p.delisted_at IS NULL
         ORDER BY ppi.synced_at IS NULL DESC, ppi.synced_at ASC, p.id ASC
         LIMIT ?
        """;

    private static final String UPSERT_SQL = """
        INSERT INTO place_pet_info (
            id,
            place_id,
            acmpy_type_cd,
            acmpy_psbl_cpam,
            acmpy_need_mtr,
            etc_acmpy_info,
            rela_acdnt_risk_mtr,
            rela_frnsh_prdlst,
            rela_poses_fclty,
            rela_purc_prdlst,
            rela_rntl_prdlst,
            allowance_scope,
            allowed_pet_size,
            leash_required,
            synced_at,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            acmpy_type_cd = VALUES(acmpy_type_cd),
            acmpy_psbl_cpam = VALUES(acmpy_psbl_cpam),
            acmpy_need_mtr = VALUES(acmpy_need_mtr),
            etc_acmpy_info = VALUES(etc_acmpy_info),
            rela_acdnt_risk_mtr = VALUES(rela_acdnt_risk_mtr),
            rela_frnsh_prdlst = VALUES(rela_frnsh_prdlst),
            rela_poses_fclty = VALUES(rela_poses_fclty),
            rela_purc_prdlst = VALUES(rela_purc_prdlst),
            rela_rntl_prdlst = VALUES(rela_rntl_prdlst),
            allowance_scope = VALUES(allowance_scope),
            allowed_pet_size = VALUES(allowed_pet_size),
            leash_required = VALUES(leash_required),
            synced_at = NOW(),
            updated_at = NOW()
        """;

    /** 있는 행만 민다. INSERT 가 없는 이유는 {@link PlacePetInfoBulkPort#touchSyncedAt} 참고. */
    private static final String TOUCH_SYNCED_SQL = """
        UPDATE place_pet_info
           SET synced_at = NOW(),
               updated_at = NOW()
         WHERE place_id = ?
        """;

    private static final String DELETE_BY_CONTENT_IDS_SQL_TEMPLATE = """
        DELETE ppi
          FROM place_pet_info ppi
          JOIN place p ON p.id = ppi.place_id
         WHERE p.source = 'TOUR_API'
           AND p.content_id IN (%s)
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<PlacePetInfoTargetQueryResult> findTourApiTargets(Collection<Long> contentIds, int limit) {
        // 빈 목록이면 IN () 가 문법 오류다. 호출 전에 접는다.
        if (contentIds == null || contentIds.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<Object> arguments = new ArrayList<>(contentIds);
        arguments.add(limit);

        return jdbcTemplate.query(SELECT_TARGETS_SQL_TEMPLATE.formatted(placeholders(contentIds.size())),
            (rs, rowNum) -> new PlacePetInfoTargetQueryResult(rs.getLong("id"), rs.getLong("content_id")),
            arguments.toArray());
    }

    @Override
    public void upsert(long placeId, ImportedPlacePetInfo petInfo) {
        jdbcTemplate.update(UPSERT_SQL,
            placeId,
            placeId,
            truncate(petInfo.acmpyTypeCd(), ACMPY_TYPE_CD_MAX, "acmpy_type_cd"),
            truncate(petInfo.acmpyPsblCpam(), ACMPY_PSBL_CPAM_MAX, "acmpy_psbl_cpam"),
            truncate(petInfo.acmpyNeedMtr(), ACMPY_NEED_MTR_MAX, "acmpy_need_mtr"),
            petInfo.etcAcmpyInfo(),
            truncate(petInfo.relaAcdntRiskMtr(), RELA_ACDNT_RISK_MTR_MAX, "rela_acdnt_risk_mtr"),
            truncate(petInfo.relaFrnshPrdlst(), RELA_ITEM_LIST_MAX, "rela_frnsh_prdlst"),
            truncate(petInfo.relaPosesFclty(), RELA_ITEM_LIST_MAX, "rela_poses_fclty"),
            truncate(petInfo.relaPurcPrdlst(), RELA_ITEM_LIST_MAX, "rela_purc_prdlst"),
            truncate(petInfo.relaRntlPrdlst(), RELA_ITEM_LIST_MAX, "rela_rntl_prdlst"),
            petInfo.allowanceScope(),
            petInfo.allowedPetSize(),
            // leash_required 는 NOT NULL 이라 null 을 넘길 수 없다 — 모델이 primitive boolean 인 이유다.
            petInfo.leashRequired());
    }

    @Override
    public void touchSyncedAt(long placeId) {
        jdbcTemplate.update(TOUCH_SYNCED_SQL, placeId);
    }

    @Override
    public int deleteByContentIds(Collection<Long> contentIds) {
        if (contentIds == null || contentIds.isEmpty()) {
            return 0;
        }
        return jdbcTemplate.update(DELETE_BY_CONTENT_IDS_SQL_TEMPLATE.formatted(placeholders(contentIds.size())),
            contentIds.toArray());
    }

    private String placeholders(int count) {
        return String.join(", ", Collections.nCopies(count, "?"));
    }

    /**
     * 컬럼 길이로 자른다 — 자르지 않으면 MySQL strict 모드가 {@code Data too long} 으로 스텝 전체를
     * 죽인다. 서로게이트 페어 경계 처리까지 {@link JdbcPlaceIntroBulkAdapter} 의 같은 이름 메서드와 같다.
     */
    private String truncate(String value, int maxLength, String columnName) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        int end = maxLength;
        if (Character.isHighSurrogate(value.charAt(end - 1))) {
            end--;
        }
        log.debug("place_pet_info value truncated. column={}, length={}, max={}", columnName, value.length(), maxLength);
        return value.substring(0, end);
    }
}
