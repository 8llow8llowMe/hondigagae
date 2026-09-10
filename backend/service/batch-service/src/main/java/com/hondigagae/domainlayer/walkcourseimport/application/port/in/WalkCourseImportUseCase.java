package com.hondigagae.domainlayer.walkcourseimport.application.port.in;

public interface WalkCourseImportUseCase {

    /**
     * 제주올레 코스를 CSV + TourAPI 매칭으로 적재한다.
     *
     * @param forceImport true 면 원천 파일이 직전과 같아도 다시 적재한다
     */
    OlleCourseImportResult importOlleCourses(boolean forceImport);

    /**
     * @param imported          이번 실행에서 upsert 한 코스 수. 건너뛰면 0
     * @param skippedUnchanged  직전과 같은 파일이라 적재를 건너뛰었는지
     * @param fileId            포털 파일 식별자. 우회 적재면 null
     * @param fallbackUsed      로컬 우회 파일을 썼는지
     */
    record OlleCourseImportResult(int imported, boolean skippedUnchanged, String fileId, boolean fallbackUsed) {
    }
}
