package com.hondigagae.domainlayer.congestionimport.application.port.in;

/**
 * 집중률 적재 배치 진입점. 배치는 웹이 아니므로 {@code *UseCase} 로 명명한다
 * (coding-conventions §5).
 */
public interface CongestionImportUseCase {

    CongestionImportResult importJejuCongestion(int numOfRows);

    /**
     * @param fetched   원천에서 받은 행 수
     * @param upserted  적재된 행 수
     * @param linked    장소와 연결에 성공한 명칭 수
     * @param unmatched 연결하지 못한 명칭 수. 0 이 아닌 것이 정상이며 커버리지 지표로 남긴다
     */
    record CongestionImportResult(int fetched, int upserted, int linked, int unmatched) {

    }
}
