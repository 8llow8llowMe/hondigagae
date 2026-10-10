package com.hondigagae.domainlayer.walkcourse.domain.enums;

/**
 * 코스 목록 정렬. 기본은 코스번호 순이다 - 올레 코스는 번호가 곧 사용자가 아는 이름이라
 * (1코스, 7코스...) 번호 순서가 무작위로 흔들리면 같은 화면을 두 번 볼 때 다른 것으로 읽는다.
 */
public enum WalkCourseSort {

    COURSE_NO,
    DISTANCE_ASC,
    DISTANCE_DESC,
    DURATION_ASC
}
