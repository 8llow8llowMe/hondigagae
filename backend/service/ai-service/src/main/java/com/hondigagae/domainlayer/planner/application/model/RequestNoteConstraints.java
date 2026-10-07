package com.hondigagae.domainlayer.planner.application.model;

/**
 * 사용자 요청 문구에서 후보 풀이 맞춰야 하는 명시 조건 (#1170).
 *
 * <p>자유 서술 전체를 해석하지 않는다. "실내", "카페" 처럼 장소 데이터(실내 여부 · 분류)로
 * 확인할 수 있는 낱말만 본다. 그 밖의 요청("바다 보며 산책")은 지금처럼 프롬프트 문장으로만 남는다.
 */
public record RequestNoteConstraints(boolean cafe, boolean indoor) {

    /** tour-service 장소 검색의 {@code sourceCategory} 완전 일치 값. */
    public static final String CAFE_CATEGORY = "카페";

    /** 숙소의 {@code contentTypeName}. 실내 휴식 요청을 숙소가 대신하지 않게 가른다. */
    public static final String LODGING_CONTENT_TYPE = "숙박";

    public static RequestNoteConstraints from(String requestNote) {
        if (requestNote == null || requestNote.isBlank()) {
            return new RequestNoteConstraints(false, false);
        }
        return new RequestNoteConstraints(requestNote.contains(CAFE_CATEGORY), requestNote.contains("실내"));
    }

    public boolean asksAnything() {
        return cafe || indoor;
    }

    /** 실내를 요청했을 때만 검색 필터. 아니면 조건을 걸지 않는다. */
    public Boolean indoorFilter() {
        return indoor ? Boolean.TRUE : null;
    }

    /** 카페를 요청했을 때만 검색 필터. */
    public String categoryFilter() {
        return cafe ? CAFE_CATEGORY : null;
    }

    public static boolean isCafe(PlaceCandidate candidate) {
        return candidate.sourceCategory() != null && candidate.sourceCategory().contains(CAFE_CATEGORY);
    }

    /**
     * 찾아갈 실내 장소. 숙소는 실내여도 빠진다 — "오후엔 실내 카페" 의 자리가 숙소뿐이면
     * 요청을 반영한 것이 아니다.
     */
    public static boolean isIndoorVisit(PlaceCandidate candidate) {
        return Boolean.TRUE.equals(candidate.indoor())
            && !LODGING_CONTENT_TYPE.equals(candidate.contentTypeName());
    }

    /** 실내와 카페를 함께 요청했으면 한 장소가 둘 다여야 한다. */
    public boolean matches(PlaceCandidate candidate) {
        if (cafe && indoor) {
            return isCafe(candidate) && isIndoorVisit(candidate);
        }
        if (cafe) {
            return isCafe(candidate);
        }
        if (indoor) {
            return isIndoorVisit(candidate);
        }
        return false;
    }
}
