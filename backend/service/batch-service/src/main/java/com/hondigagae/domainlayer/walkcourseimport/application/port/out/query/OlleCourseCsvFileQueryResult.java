package com.hondigagae.domainlayer.walkcourseimport.application.port.out.query;

import java.nio.file.Path;

/**
 * 내려받아 둔 올레 CSV 파일.
 *
 * @param path          내려받은 임시 파일 경로. 적재가 끝나면 지운다
 * @param fileName      Content-Disposition 이 알려 준 원본 파일명. 못 읽었으면 null
 * @param contentLength 디스크에 실제로 쓰인 바이트 수 (헤더 값이 아니다)
 */
public record OlleCourseCsvFileQueryResult(Path path, String fileName, long contentLength) {

}
