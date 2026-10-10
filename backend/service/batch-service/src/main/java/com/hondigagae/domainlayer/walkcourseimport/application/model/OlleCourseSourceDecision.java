package com.hondigagae.domainlayer.walkcourseimport.application.model;

import java.nio.file.Path;

/**
 * 이번 실행에서 무엇을 읽을지에 대한 결정.
 *
 * <p>세 갈래다 - 포털에서 새 파일을 받아 적재({@code IMPORT}, fallback=false), 직전과 같은
 * 파일이라 건너뜀({@code SKIP_UNCHANGED}), 포털이 막혀 로컬 우회 파일로 적재({@code IMPORT},
 * fallback=true).
 *
 * <p>{@code fallback} 을 결과에 남기는 이유가 둘이다. 우회 파일은 <b>지우면 안 되고</b>(다음
 * 실행이 쓸 마지막 보루다), 우회 적재는 <b>포털 스냅샷 대신 우회 행을 남긴다</b> - 우회 파일을
 * 포털 판본처럼 남기면 다음 실행이 포털을 다시 보지 않고 건너뛰고, 아무것도 남기지 않으면 포털 복귀
 * 첫 실행이 마지막 포털 적재분과 같은 파일로 보고 건너뛴다 (#887, {@code SourceFileSnapshotRule}).
 *
 * @param kind          적재할지 건너뛸지
 * @param csvFile       읽을 CSV. {@code SKIP_UNCHANGED} 면 null
 * @param fileId        원천 파일 식별자. 우회 적재면 null (포털을 못 봤다)
 * @param fileName      원본 파일명. 모르면 null
 * @param contentLength 받은 바이트 수. 모르면 null
 * @param fallback      로컬 우회 파일인지
 */
public record OlleCourseSourceDecision(
    Kind kind, Path csvFile, String fileId, String fileName, Long contentLength, boolean fallback
) {

    public enum Kind {
        IMPORT,
        SKIP_UNCHANGED
    }

    public static OlleCourseSourceDecision importFrom(Path csvFile, String fileId, String fileName, Long contentLength) {
        return new OlleCourseSourceDecision(Kind.IMPORT, csvFile, fileId, fileName, contentLength, false);
    }

    public static OlleCourseSourceDecision skipUnchanged(String fileId) {
        return new OlleCourseSourceDecision(Kind.SKIP_UNCHANGED, null, fileId, null, null, false);
    }

    public static OlleCourseSourceDecision fallback(Path csvFile) {
        return new OlleCourseSourceDecision(Kind.IMPORT, csvFile, null, null, null, true);
    }
}
