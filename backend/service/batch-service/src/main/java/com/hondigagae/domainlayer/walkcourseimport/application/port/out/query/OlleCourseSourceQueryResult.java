package com.hondigagae.domainlayer.walkcourseimport.application.port.out.query;

/**
 * 공공데이터포털 상세 페이지에서 읽어낸 "지금 올라와 있는 파일" 정보.
 *
 * @param fileId       {@code atchFileId}. 제공기관이 새 파일을 올리면 바뀐다
 * @param fileDetailSn {@code fileDetailSn}. 한 게시물에 파일이 여럿일 때의 순번
 * @param contentUrl   실제 다운로드 주소 (쿼리스트링 포함 원문 그대로)
 */
public record OlleCourseSourceQueryResult(String fileId, String fileDetailSn, String contentUrl) {

}
