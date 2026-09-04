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

    private static final String SELECT_TARGETS_SQL = """
        SELECT id, content_id
        FROM place
        WHERE source = 'TOUR_API'
          AND content_id IS NOT NULL
          AND merged_into_id IS NULL
          AND delisted_at IS NULL
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
    public List<PlaceImageTargetQueryResult> findTourApiTargets() {
        return jdbcTemplate.query(SELECT_TARGETS_SQL,
            (rs, rowNum) -> new PlaceImageTargetQueryResult(rs.getLong("id"), rs.getLong("content_id")));
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
