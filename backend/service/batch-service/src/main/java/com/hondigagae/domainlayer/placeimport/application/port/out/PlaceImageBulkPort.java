package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageBackfillTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import java.util.List;

/**
 * place_image 대량 쓰기 포트 (coding-conventions §12-3 *BulkPort).
 */
public interface PlaceImageBulkPort {

    /** 추가 이미지 적재 대상 — 노출 중인(병합·delisted 아님) TourAPI 원천 장소. */
    List<PlaceImageTargetQueryResult> findTourApiTargets();

    /**
     * 한 장소의 이미지를 통째로 교체한다(삭제 후 재삽입). 원천이 이미지를 내리면 우리도
     * 내려가야 하므로 병합(upsert)이 아니라 교체다. 행 id 는 (placeId, serialNum) 해시라
     * 재실행이 멱등이다.
     */
    int replaceImages(long placeId, List<ImportedPlaceImage> images);

    /**
     * 대표 이미지 백필 대상 — TourAPI 가 아닌 원천이면서 이미지가 없고 좌표가 있는 노출 장소.
     * 좌표 없는 행은 같은 장소 검증이 불가능해 대상에서 뺀다.
     */
    List<PlaceImageBackfillTargetQueryResult> findImageBackfillTargets();

    /** 대표 이미지만 채운다. 원천 재적재(upsert)가 이미지 컬럼을 건드리지 않는 원천에만 쓴다. */
    void updateFirstImage(long placeId, String firstImage, String firstImage2);
}
