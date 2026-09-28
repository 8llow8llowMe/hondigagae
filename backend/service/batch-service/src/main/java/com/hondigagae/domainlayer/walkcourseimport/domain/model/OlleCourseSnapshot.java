package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import com.hondigagae.domainlayer.placeimport.domain.model.SourceFileSnapshotRule;
import java.time.LocalDateTime;

/**
 * 올레 CSV 를 무엇으로 받았는지 남긴 스냅샷.
 *
 * <p>테이블은 문화정보원과 같은 {@code import_source_snapshot} 이다. {@code source} 컬럼에
 * {@link #SOURCE} 를 써서 장소 원천과 섞이지 않는다. 올레는 제주 전용이므로
 * {@link #AREA_CODE} 도 고정이다.
 *
 * <p>우회 적재가 성공하면 {@link #fallback} 행을 남긴다 (#887, {@link SourceFileSnapshotRule}).
 *
 * @param fileId            원천 파일 식별자 (포털 atchFileId). 우회 행이면 {@link SourceFileSnapshotRule#FALLBACK_FILE_ID}
 * @param fileName          Content-Disposition 파일명. 못 읽었으면 null
 * @param contentLength     실제로 받은 바이트 수. 우회 행이면 0
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
     * 우회 적재가 성공했다는 행 (#887). {@code file_id} 에 {@link SourceFileSnapshotRule#FALLBACK_FILE_ID} 를 싣는다.
     *
     * <p>이 행이 최신이면 다음 포털 실행은 파일이 그대로여도 적재한다 — 우회 파일이 포털에 지금
     * 올라와 있는 것과 같다는 보장이 없어서다.
     *
     * @param fileName 우회 파일 이름. 사람이 어느 파일로 돌았는지 되짚는 용도
     */
    public static OlleCourseSnapshot fallback(
        String fileName, LocalDateTime sourceModifiedMax, int importedCount, LocalDateTime runStartedAt
    ) {
        return new OlleCourseSnapshot(SourceFileSnapshotRule.FALLBACK_FILE_ID, fileName,
            SourceFileSnapshotRule.FALLBACK_CONTENT_LENGTH, sourceModifiedMax, importedCount, runStartedAt);
    }

    /** 우회 적재 행인가. */
    public boolean isFallback() {
        return SourceFileSnapshotRule.isFallbackMarker(fileId);
    }

    /**
     * 지금 원천이 내주는 파일이 이 스냅샷과 같은 파일인가. 규칙은 문화정보원과 같은
     * {@link SourceFileSnapshotRule#sameFile} 하나다.
     *
     * <p>크기를 아직 모르는 시점(내려받기 전)에는 {@code otherContentLength} 에 null 을 준다.
     * 이 스냅샷이 우회 행이면 언제나 false 다.
     */
    public boolean sameFileAs(String otherFileId, Long otherContentLength) {
        return SourceFileSnapshotRule.sameFile(fileId, contentLength, otherFileId, otherContentLength);
    }
}
