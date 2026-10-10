package com.hondigagae.domainlayer.placeimport.adapter.out.persistence;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImageBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageBackfillTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * place_image JDBC 벌크 어댑터.
 *
 * <p>장소 단위 교체(삭제 후 재삽입)라 트랜잭션은 장소 하나 범위면 충분하다 — 한 장소
 * 실패가 다른 장소의 이미지를 롤백할 이유가 없다.
 */
@Component
@RequiredArgsConstructor
public class JdbcPlaceImageBulkAdapter implements PlaceImageBulkPort {

    /**
     * 대상 선정 (#478). {@code source = 'TOUR_API'} 로 가둬 detailImage2 가 없는 원천을 빼고,
     * 병합·delisted 행도 뺀다 — 화면에 안 나오는 장소에 희소한 쿼터를 쓰지 않는다.
     *
     * <p>정렬은 "한 번도 부르지 않은 곳 먼저 → {@code image_synced_at} 오래된 순". MySQL 은
     * {@code IS NULL} 이 불리언 0/1 이라 {@code DESC} 로 정렬하면 NULL(=1)이 앞에 온다.
     * 마지막 {@code p.id} 는 동률을 가르는 결정적 기준이다 — 없으면 어느 행이 상한 안에 드는지
     * 실행마다 달라져, 왜 이 장소가 빠졌는지 나중에 설명할 수 없다. 운영시간 대상 쿼리와 같은 3단이다.
     *
     * <p><b>커서가 {@code place_image} 가 아니라 {@code place} 에 있는 이유</b>: 원천이 이미지를
     * 주지 않는 장소는 {@code place_image} 행이 아예 없어 "언제 확인했나"를 적을 자리가 없다.
     * 그대로 두면 그 장소들(약 30%)이 NULL 머리를 영원히 독식한다.
     */
    private static final String SELECT_TARGETS_SQL = """
        SELECT p.id, p.content_id
          FROM place p
         WHERE p.source = 'TOUR_API'
           AND p.content_id IS NOT NULL
           AND p.merged_into_id IS NULL
           AND p.delisted_at IS NULL
         ORDER BY p.image_synced_at IS NULL DESC, p.image_synced_at ASC, p.id ASC
         LIMIT ?
        """;

    /**
     * 이번 실행에서 확인을 마친 장소의 커서만 민다. 커서가 {@code place} 행에 있어 단순 UPDATE 다
     * ({@code JdbcPlaceBulkAdapter.MFDS_TOUCH_SYNCED_SQL} 과 같은 모양). {@code synced_at} 은
     * 목록 적재의 것이라 건드리지 않는다.
     */
    private static final String TOUCH_IMAGE_SYNCED_SQL = """
        UPDATE place
           SET image_synced_at = NOW(),
               updated_at = NOW()
         WHERE id = ?
        """;

    private static final String SELECT_BACKFILL_TARGETS_SQL = """
        SELECT id, title, lat, lng
        FROM place
        WHERE source <> 'TOUR_API'
          AND (first_image IS NULL OR first_image = '')
          AND lat IS NOT NULL AND lng IS NOT NULL
          AND merged_into_id IS NULL
          AND delisted_at IS NULL
        """;

    private static final String UPDATE_FIRST_IMAGE_SQL = """
        UPDATE place
           SET first_image = ?, first_image2 = ?, updated_at = NOW()
         WHERE id = ?
        """;

    private static final String DELETE_SQL = "DELETE FROM place_image WHERE place_id = ?";

    private static final String INSERT_SQL = """
        INSERT INTO place_image (
            id, place_id, origin_img_url, small_image_url, img_name, serial_num, cpyrht_div_cd,
            synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
        """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<PlaceImageTargetQueryResult> findTourApiTargets(int limit) {
        // 상한이 0 이하면 LIMIT 0 을 쏘는 대신 접는다 (운영시간 포트와 같은 규칙) —
        // 프로퍼티가 접히지 않은 상태로 들어왔을 때 쓸모없는 쿼리를 막는다.
        if (limit <= 0) {
            return List.of();
        }
        return jdbcTemplate.query(SELECT_TARGETS_SQL,
            (rs, rowNum) -> new PlaceImageTargetQueryResult(rs.getLong("id"), rs.getLong("content_id")), limit);
    }

    @Override
    public void touchImageSyncedAt(long placeId) {
        jdbcTemplate.update(TOUCH_IMAGE_SYNCED_SQL, placeId);
    }

    @Override
    public List<PlaceImageBackfillTargetQueryResult> findImageBackfillTargets() {
        return jdbcTemplate.query(SELECT_BACKFILL_TARGETS_SQL, (rs, rowNum) -> new PlaceImageBackfillTargetQueryResult(
            rs.getLong("id"), rs.getString("title"), rs.getDouble("lat"), rs.getDouble("lng")));
    }

    @Override
    public void updateFirstImage(long placeId, String firstImage, String firstImage2) {
        jdbcTemplate.update(UPDATE_FIRST_IMAGE_SQL, firstImage, firstImage2, placeId);
    }

    @Override
    public int replaceImages(long placeId, List<ImportedPlaceImage> images) {
        jdbcTemplate.update(DELETE_SQL, placeId);
        if (images.isEmpty()) {
            return 0;
        }
        jdbcTemplate.batchUpdate(INSERT_SQL, images, images.size(), (ps, image) -> {
            ps.setLong(1, imageId(placeId, image.serialNum(), image.originImgUrl()));
            ps.setLong(2, placeId);
            ps.setString(3, image.originImgUrl());
            ps.setString(4, image.smallImageUrl());
            ps.setString(5, image.imgName());
            ps.setString(6, effectiveSerialNum(image));
            ps.setString(7, image.cpyrhtDivCd());
        });
        return images.size();
    }

    /**
     * serialNum 이 빈 원천 행 대비 — uk_place_image_place_id_serial_num 유니크 인덱스가
     * 빈 값 두 개를 충돌시키므로, URL 해시 앞 16자를 결정적 대체값으로 쓴다.
     */
    private String effectiveSerialNum(ImportedPlaceImage image) {
        if (image.serialNum() != null && !image.serialNum().isBlank()) {
            return image.serialNum();
        }
        return Long.toHexString(imageId(0L, null, image.originImgUrl()));
    }

    /**
     * (placeId, serialNum) 해시 기반 결정적 id — 재실행이 같은 이미지에 같은 id 를 준다.
     * serialNum 이 비어 있는 원천 데이터를 대비해 URL 을 함께 섞는다.
     * place_image 는 자체 PK 공간이라 place id 대역과 무관하다.
     */
    private long imageId(long placeId, String serialNum, String originImgUrl) {
        String seed = placeId + "|" + (serialNum == null ? "" : serialNum) + "|" + (originImgUrl == null ? "" : originImgUrl);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(seed.getBytes(StandardCharsets.UTF_8));
            long value = 0L;
            for (int index = 0; index < Long.BYTES; index++) {
                value = (value << 8) | (digest[index] & 0xFF);
            }
            return value & Long.MAX_VALUE;
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
