package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 제주올레 코스 CSV 설정.
 *
 * <p>파일데이터라 인증키가 필요 없다. 공공데이터포털에서 받은 CSV 경로만 지정한다.
 * (data.go.kr/data/15043496 — 활용신청 없이 다운로드된다)
 */
@ConfigurationProperties(prefix = "olle-course")
public record OlleCourseProperties(
    String filePath
) {

    public OlleCourseProperties {
        if (filePath == null || filePath.isBlank()) {
            filePath = "data/olle_course.csv";
        }
    }
}
