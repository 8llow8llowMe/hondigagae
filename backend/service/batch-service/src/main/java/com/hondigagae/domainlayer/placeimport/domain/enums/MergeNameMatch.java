package com.hondigagae.domainlayer.placeimport.domain.enums;

/**
 * 병합 판정에서 두 이름이 어떻게 겹쳤는지. <b>선언 순서가 근거의 세기다</b> — 앞일수록 같은 곳이라는 근거가 강하고
 * 허용 반경도 넓다. 흡수 후보가 여럿이면 앞선 쪽을 고른다 ({@code PlaceMergeProcessor}).
 */
public enum MergeNameMatch {

    /** 정규화한 이름이 같다. */
    EXACT,
    /** 한쪽 이름이 다른 쪽을 통째로 품는다 ({@code 노리매} ⊂ {@code 노리매공원}). */
    CONTAINED,
    /** 고유한 공통 부분을 넉넉히 함께 갖는다 ({@code 도치돌목장} · {@code 도치돌 알파카목장}, #1282). */
    SHARED_CORE
}
