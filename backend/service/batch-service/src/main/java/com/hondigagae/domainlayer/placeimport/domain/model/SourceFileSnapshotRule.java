package com.hondigagae.domainlayer.placeimport.domain.model;

/**
 * 원천 파일 스냅샷의 "같은 파일인가" 판정 규칙 (#379 · #887).
 *
 * <p>{@code import_source_snapshot} 을 쓰는 두 잡 — 문화정보원({@link ImportSourceSnapshot})과
 * 올레({@code OlleCourseSnapshot}) — 이 이 규칙 하나를 같이 쓴다. 한쪽만 고치면 같은 포털·같은
 * 우회 구조에서 두 잡이 다른 답을 낸다 ({@link PlaceNameMatcher} 처럼 컨텍스트를 건너 재사용한다).
 *
 * <p><b>우회 행.</b> 포털이 막혀 로컬 우회 파일로 적재에 성공하면 {@link #FALLBACK_FILE_ID} 를
 * {@code file_id} 에 넣은 행을 남긴다. 직전 행이 우회 행이면 <b>어떤 포털 파일과도 같은 파일이
 * 아니다</b> — 그래서 포털이 되살아난 첫 실행은 파일이 그대로여도 다시 받아 적재하고, 그 적재가 남긴
 * 포털 행부터 다시 건너뛰기가 돈다.
 *
 * <p>예전에는 우회 적재가 아무 행도 남기지 않았다. 그러면 스냅샷은 <b>마지막 포털 적재분</b>을
 * 가리키고, 포털 파일이 그때와 같으면 복귀 첫 실행이 곧바로 건너뛰어 DB 에 우회 파일 값이 남았다 —
 * 우회 파일이 포털 판본보다 낡았으면 제공기관이 새 파일을 올릴 때까지 조용히 (#887).
 *
 * <p>스키마를 바꾸지 않으려고 마커를 {@code file_id} 에 싣는다. prod DDL 은 런북 적용이라 컬럼을
 * 늘리는 비용이 크고, 포털 {@code atchFileId} 는 {@code FILE_…} 형식이라 마커와 겹치지 않는다.
 */
public final class SourceFileSnapshotRule {

    /** 우회 적재 행의 {@code file_id}. 포털 {@code atchFileId}({@code FILE_…})와 겹치지 않는다. */
    public static final String FALLBACK_FILE_ID = "LOCAL_FALLBACK";

    /** 우회 적재 행의 {@code content_length}. 포털에서 받은 바이트가 없다 (컬럼이 NOT NULL 이라 0 을 쓴다). */
    public static final long FALLBACK_CONTENT_LENGTH = 0L;

    private SourceFileSnapshotRule() {
    }

    /** 이 {@code file_id} 가 우회 적재 행의 마커인가. */
    public static boolean isFallbackMarker(String recordedFileId) {
        return FALLBACK_FILE_ID.equals(recordedFileId);
    }

    /**
     * 지금 원천이 내주는 파일이 기록된 행과 같은 파일인가.
     *
     * <p>크기를 아직 모르는 시점(내려받기 전)에는 {@code currentContentLength} 에 null 을 주고 파일
     * 식별자만 비교한다. 크기를 알면 둘 다 같아야 같은 파일로 본다 - 식별자만 같고 크기가 달라졌다면
     * 같은 자리에 다른 파일이 올라온 것이므로 적재해야 한다.
     *
     * <p>기록된 행이 우회 행이면 언제나 false 다 — 그 행은 포털에 무엇이 올라와 있는지 말하지 않는다.
     */
    public static boolean sameFile(
        String recordedFileId, long recordedContentLength, String currentFileId, Long currentContentLength
    ) {
        if (recordedFileId == null || isFallbackMarker(recordedFileId) || !recordedFileId.equals(currentFileId)) {
            return false;
        }
        return currentContentLength == null || recordedContentLength == currentContentLength;
    }
}
