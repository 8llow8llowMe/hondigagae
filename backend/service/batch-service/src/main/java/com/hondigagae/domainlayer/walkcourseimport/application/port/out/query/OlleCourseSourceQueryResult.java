package com.hondigagae.domainlayer.walkcourseimport.application.port.out.query;

/**
 * 공공데이터포털에서 읽어낸 "지금 올라와 있는 파일" 정보.
 *
 * <p>상세 페이지의 다운로드 버튼 인자로 {@code selectFileDataDownload.do} 를 불러 받는다.
 * 비교 키는 여전히 파일 단위 {@code atchFileId} 다 — 페이지의 {@code uddi:} 상세 PK 는 데이터셋 상세
 * 단위라 파일이 바뀌어도 같을 수 있고, {@code atchFileId} 는 예전 JSON-LD 경로가 뽑던 값과 같아
 * 기존 스냅샷이 그대로 이어진다 (#876).
 *
 * @param fileId       {@code atchFileId}. 제공기관이 새 파일을 올리면 바뀐다. 스냅샷 비교 키다
 * @param fileDetailSn {@code fileDetailSn}. 한 게시물에 파일이 여럿일 때의 순번
 * @param contentUrl   실제 다운로드 주소 ({@code /cmm/cmm/fileDownload.do?atchFileId=…&fileDetailSn=…})
 */
public record OlleCourseSourceQueryResult(String fileId, String fileDetailSn, String contentUrl) {

}
