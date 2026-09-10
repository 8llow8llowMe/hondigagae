package com.hondigagae.domainlayer.placeimport.application.port.in;

/**
 * 문화정보원 문화시설 적재 배치 진입점. 배치는 웹이 아니므로 {@code *UseCase} 로 명명한다
 * (coding-conventions §5).
 */
public interface CultureFacilityImportUseCase {

    /**
     * 문화정보원 문화시설을 적재한다.
     *
     * @param sido        시도 명칭 (예: 제주특별자치도)
     * @param forceImport true 면 원천 파일이 직전과 같아도 다시 적재한다
     */
    CultureFacilityImportResult importFacilities(String sido, boolean forceImport);

    /**
     * @param imported         적재한 장소 수. 건너뛴 실행은 0 이다
     * @param skippedUnchanged 원천 파일이 직전과 같아 적재를 건너뛰었는지
     * @param fileId           이번에 확인한 원천 파일 식별자(atchFileId). 로컬 우회 적재면 null
     * @param fallbackUsed     포털에서 받지 못해 로컬 우회 파일로 적재했는지
     */
    record CultureFacilityImportResult(int imported, boolean skippedUnchanged, String fileId, boolean fallbackUsed) {

    }
}
