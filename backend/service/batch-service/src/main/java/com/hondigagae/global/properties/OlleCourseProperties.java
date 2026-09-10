package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 제주올레 코스 CSV 설정.
 *
 * <p>파일데이터라 인증키가 필요 없다. 공공데이터포털 상세 페이지(data.go.kr/data/15043496)가
 * 서버 렌더링이고 그 안 JSON-LD 에 파일 다운로드 주소가 그대로 들어 있어, <b>배치가 직접
 * 내려받는 것이 기본</b>이다.
 *
 * <p>{@code filePath} 는 그 자동 경로가 막혔을 때의 <b>우회용 파일</b>이다. 컨테이너에서 이
 * 경로({@code /app/data})는 읽기 전용으로 붙으므로 내려받은 파일을 여기에 쓸 수 없다 -
 * 다운로드는 {@code downloadDir}(비면 JVM 임시 디렉터리)로 스트리밍한다.
 *
 * @param filePath         우회용 CSV 경로. 포털에서 받지 못했을 때만 읽는다
 * @param downloadEnabled  포털 자동 다운로드 사용 여부. 기본 true. 래퍼 타입인 이유는 배포 값이
 *                         늘 불리언 리터럴이 아니기 때문이다 - compose 의 {@code ${VAR:-}} 는
 *                         변수를 빈 문자열로 만들고, 빈 문자열은 바인딩에서 null 로 떨어진다
 * @param baseUrl          공공데이터포털 기준 URL
 * @param datasetId        데이터셋 번호. 상세 페이지 경로 {@code /data/{datasetId}/fileData.do} 를 만든다
 * @param downloadDir      내려받을 디렉터리. 비면 어댑터가 {@code java.io.tmpdir} 로 해석한다
 * @param readTimeoutMs    단계(페이지·다운로드)별 상한(ms). 기본 120,000
 * @param minContentLength 이보다 작은 파일은 CSV 가 아니라 오류 페이지로 본다.
 *                         올레 CSV 는 수십 행이라 문화정보원(1MB)보다 낮게 둔다. 기본 200
 */
@ConfigurationProperties(prefix = "olle-course")
public record OlleCourseProperties(
    String filePath,
    Boolean downloadEnabled,
    String baseUrl,
    String datasetId,
    String downloadDir,
    Integer readTimeoutMs,
    Long minContentLength
) {

    public OlleCourseProperties {
        if (downloadEnabled == null) {
            downloadEnabled = true;
        }
        if (filePath == null || filePath.isBlank()) {
            filePath = "data/olle_course.csv";
        }
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://www.data.go.kr";
        }
        if (datasetId == null || datasetId.isBlank()) {
            datasetId = "15043496";
        }
        if (downloadDir != null && downloadDir.isBlank()) {
            downloadDir = null;
        }
        if (readTimeoutMs == null || readTimeoutMs <= 0) {
            readTimeoutMs = 120_000;
        }
        if (minContentLength == null || minContentLength <= 0) {
            minContentLength = 200L;
        }
    }
}
