package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilityCsvFileQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilitySourceQueryResult;

/**
 * 문화정보원 CSV 원천 조회·내려받기 계약.
 *
 * <p>원천이 "공공데이터포털 상세 페이지의 JSON-LD 를 긁어 파일 주소를 찾는" 방식이라는 사실은
 * adapter 안에 갇힌다. 나중에 포털이 오픈 API 를 열면 이 계약은 그대로 두고 어댑터만 바꾼다.
 *
 * <p>두 단계로 나눈 이유가 갱신 감지다. 먼저 주소만 확인해 파일 식별자를 얻고, 직전 적재와
 * 같으면 <b>30MB 를 내려받기 전에</b> 건너뛴다.
 */
public interface CultureFacilitySourcePort {

    /** 지금 포털에 올라와 있는 파일의 식별자와 다운로드 주소를 읽는다. */
    CultureFacilitySourceQueryResult resolveLatest();

    /** 파일을 임시 디렉터리로 스트리밍해 받는다. 컨테이너의 {@code /app/data} 는 읽기 전용이라 쓸 수 없다. */
    CultureFacilityCsvFileQueryResult download(CultureFacilitySourceQueryResult source);
}
