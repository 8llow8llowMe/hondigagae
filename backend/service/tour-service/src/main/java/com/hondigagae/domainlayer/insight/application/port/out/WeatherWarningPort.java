package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.util.List;

/**
 * 기상특보 조회 계약.
 *
 * <p>예보와 원천이 다르다. 기상청 <b>기상특보 조회서비스</b>는 공공데이터포털에서 단기·중기예보와
 * 별개로 활용신청해야 하고, 그래서 <b>승인 전에는 이 포트만 실패한다.</b>
 *
 * <p>그 사실이 이 계약의 모양을 정한다 - <b>실패를 예외로 올리지 않고 빈 목록으로 준다.</b>
 * 특보 조회가 안 된다고 적합도와 산책 위험도가 멎으면, 아직 신청하지 않은 API 하나가 이미
 * 동작하는 기능 둘을 끌어내리는 셈이다.
 *
 * <p>다만 <b>빈 목록은 "특보 없음"과 구분되지 않는다.</b> 그것을 감수하는 이유는 특보가 없는
 * 것이 압도적으로 흔한 상태이기 때문이다. 대신 어댑터가 실패를 로그로 남긴다.
 */
public interface WeatherWarningPort {

    /** 해당 지점에 발효 중인 특보. 없거나 조회에 실패하면 빈 목록이다. */
    List<WeatherWarning> findActiveWarnings(String stationId);
}
