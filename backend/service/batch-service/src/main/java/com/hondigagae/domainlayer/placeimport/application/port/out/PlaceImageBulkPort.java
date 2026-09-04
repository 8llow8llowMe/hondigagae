package com.hondigagae.domainlayer.placeimport.application.port.out;

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
}
