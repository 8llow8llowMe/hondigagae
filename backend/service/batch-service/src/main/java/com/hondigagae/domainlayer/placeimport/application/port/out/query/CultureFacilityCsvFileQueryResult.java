package com.hondigagae.domainlayer.placeimport.application.port.out.query;

import java.nio.file.Path;

/**
 * 내려받아 둔 CSV 파일.
 *
 * <p>{@link Path} 는 JDK 타입이라 application 계층이 어댑터 구현에 묶이지 않는다. 파일이
 * 어디에서 왔는지(포털 다운로드인지 우회 파일인지)는 이 결과가 아니라 결정 모델이 들고 있다.
 *
 * @param path          내려받은 임시 파일 경로. 적재가 끝나면 지운다
 * @param fileName      Content-Disposition 이 알려 준 원본 파일명. 못 읽었으면 null
 * @param contentLength 디스크에 실제로 쓰인 바이트 수 (헤더 값이 아니다)
 */
public record CultureFacilityCsvFileQueryResult(Path path, String fileName, long contentLength) {

}
