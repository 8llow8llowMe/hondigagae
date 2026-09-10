package com.hondigagae.domainlayer.walkcourseimport.application.port.out;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCsvFileQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseSourceQueryResult;

/**
 * 공공데이터포털에서 올레 CSV 원천을 찾는다.
 *
 * <p>페이지를 읽는 일과 파일을 받는 일을 나눈다. 식별자만 보고 직전과 같으면
 * 파일을 받기 전에 끝낼 수 있다.
 */
public interface OlleCourseSourcePort {

    /** 상세 페이지에서 지금 올라와 있는 파일 주소를 읽는다. */
    OlleCourseSourceQueryResult resolveLatest();

    /** 그 주소를 임시 파일로 내려받는다. */
    OlleCourseCsvFileQueryResult download(OlleCourseSourceQueryResult source);
}
