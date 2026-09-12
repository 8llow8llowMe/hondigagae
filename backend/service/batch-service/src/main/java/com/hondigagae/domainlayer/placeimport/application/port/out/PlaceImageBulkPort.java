package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageBackfillTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import java.util.List;

/**
 * place_image 대량 쓰기 포트 (coding-conventions §12-3 *BulkPort).
 */
public interface PlaceImageBulkPort {

    /**
     * 추가 이미지 적재 대상 — 노출 중인(병합·delisted 아님) TourAPI 원천 장소.
     *
     * <p>"한 번도 부르지 않은 곳 먼저 → 그다음 {@code place.image_synced_at} 오래된 순 → id"
     * 로 골라 {@code limit} 개만 돌려준다 (#478). 쿼터(일 1,000건)가 전량(약 964곳)을 한 번에
     * 덮을 수 없어서다 — 운영시간 스텝과 같은 규칙이고, 주 1회 실행 3주면 한 바퀴가 돈다.
     *
     * @param limit 이번 실행에서 호출할 최대 장소 수. 0 이하면 빈 목록
     */
    List<PlaceImageTargetQueryResult> findTourApiTargets(int limit);

    /**
     * 한 장소의 이미지를 통째로 교체한다(삭제 후 재삽입). 원천이 이미지를 내리면 우리도
     * 내려가야 하므로 병합(upsert)이 아니라 교체다. 행 id 는 (placeId, serialNum) 해시라
     * 재실행이 멱등이다.
     */
    int replaceImages(long placeId, List<ImportedPlaceImage> images);

    /**
     * 이번 실행에서 확인을 마친 장소의 {@code place.image_synced_at} 만 민다 (#478).
     *
     * <p><b>이게 없으면 커서가 전진하지 않아 증분이 성립하지 않는다.</b> 특히 원천이 이미지를
     * 주지 않는 장소(약 30%)와 영영 실패하는 장소(사라진 {@code contentId})는 이미지 행이 생기지
     * 않으므로, 커서를 밀지 않으면 매 실행 NULL 머리를 독식하며 나머지 장소의 차례가 오지 않는다.
     *
     * <p>커서가 {@code place} 행 자체에 있어 단순 UPDATE 다 — 운영시간 쪽은 {@code place_intro}
     * 행이 아예 없을 수 있어 upsert 였다. 이미지 컬럼은 건드리지 않는다.
     */
    void touchImageSyncedAt(long placeId);

    /**
     * 대표 이미지 백필 대상 — TourAPI 가 아닌 원천이면서 이미지가 없고 좌표가 있는 노출 장소.
     * 좌표 없는 행은 같은 장소 검증이 불가능해 대상에서 뺀다.
     */
    List<PlaceImageBackfillTargetQueryResult> findImageBackfillTargets();

    /** 대표 이미지만 채운다. 원천 재적재(upsert)가 이미지 컬럼을 건드리지 않는 원천에만 쓴다. */
    void updateFirstImage(long placeId, String firstImage, String firstImage2);
}
