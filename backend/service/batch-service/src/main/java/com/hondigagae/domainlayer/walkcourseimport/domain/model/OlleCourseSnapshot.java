package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import java.time.LocalDateTime;

/**
 * 올레 CSV 를 무엇으로 받았는지 남긴 스냅샷.
 *
 * <p>테이블은 문화정보원과 같은 {@code import_source_snapshot} 이다. {@code source} 컬럼에
 * {@link #SOURCE} 를 써서 장소 원천과 섞이지 않는다. 올레는 제주 전용이므로
 * {@link #AREA_CODE} 도 고정이다.
 *
 * @param fileId            원천 파일 식별자 (포털 atchFileId)
 * @param fileName          Content-Disposition 파일명. 못 읽었으면 null
 * @param contentLength     실제로 받은 바이트 수
 * @param sourceModifiedMax 적재한 행의 데이터기준일자 최대값. 원천에 값이 없으면 null
 * @param importedCount     이번 실행에서 적재한 코스 수
 * @param runStartedAt      적재 시작 시각
 */
public record OlleCourseSnapshot(
    String fileId,
    String fileName,
    long contentLength,
    LocalDateTime sourceModifiedMax,
    int importedCount,
    LocalDateTime runStartedAt
) {

    public static final String SOURCE = "OLLE_COURSE";
    public static final String AREA_CODE = "39";

    /**
     * 지금 원천이 내주는 파일이 이 스냅샷과 같은 파일인가.
     *
     * <p>크기를 아직 모르는 시점(내려받기 전)에는 {@code contentLength} 에 null 을 주고 파일
     * 식별자만 비교한다. 크기를 알면 둘 다 같아야 같은 파일로 본다.
     */
    public boolean sameFileAs(String otherFileId, Long otherContentLength) {
        if (fileId == null || !fileId.equals(otherFileId)) {
            return false;
        }
        return otherContentLength == null || contentLength == otherContentLength;
    }
}
