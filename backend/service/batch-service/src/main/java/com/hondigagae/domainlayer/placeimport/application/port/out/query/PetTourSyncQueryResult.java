package com.hondigagae.domainlayer.placeimport.application.port.out.query;

import java.util.List;

/**
 * 반려동물 동반여행 동기화 목록(petTourSyncList2) 한 페이지 (#877).
 *
 * <p>상세(detailPetTour2)를 부를 대상을 좁히는 데만 쓴다 — 목록에는 동반 조건 필드가 없다.
 * 그래서 contentId 와 노출 여부만 들고 온다.
 */
public record PetTourSyncQueryResult(List<Entry> entries, int pageNo, int numOfRows, int totalCount) {

    public boolean hasNext() {
        return (long) pageNo * numOfRows < totalCount;
    }

    /**
     * @param contentId 국문 관광정보와 같은 체계의 콘텐츠 id — {@code place.content_id} 에 그대로 잇는다
     * @param shown     원천의 {@code showflag}. {@code "0"} 일 때만 false 다 — 원천이 동반 정보를
     *                  <b>내렸다고 말한</b> 콘텐츠만 지우기 위해서다 (값이 비면 노출로 본다)
     */
    public record Entry(long contentId, boolean shown) {

    }
}
