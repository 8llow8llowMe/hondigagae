package com.hondigagae.domainlayer.placeimport.adapter.out.client;

/**
 * 공공데이터포털 공통 응답 코드 판별.
 *
 * <p>포털은 실패를 <b>HTTP 200 + 오류 본문</b>으로도 돌려준다. 그래서 전송 계층(서킷)은 이것을
 * 실패로 세지 않고, 어댑터가 본문을 읽어 구분해야 한다.
 *
 * <p>지금 구분이 필요한 것은 <b>일일 한도 초과</b> 하나다. 다른 오류와 달리 이것은 "이 장소만
 * 실패"가 아니라 "오늘은 더 못 부른다"는 뜻이라, 남은 대상을 계속 도는 것이 무의미하다.
 */
final class TourApiResultCodes {

    /** 한도 초과 코드. 포털이 자리수를 채워 보내는 경우가 있어 두 표기를 모두 받는다. */
    private static final String QUOTA_EXCEEDED_CODE = "22";
    private static final String QUOTA_EXCEEDED_CODE_PADDED = "0022";
    /** 코드가 비어 오고 메시지만 오는 응답도 있다. */
    private static final String QUOTA_EXCEEDED_MESSAGE = "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS";

    private TourApiResultCodes() {
    }

    static boolean quotaExceeded(String resultCode, String resultMsg) {
        if (resultCode != null) {
            String code = resultCode.trim();
            if (QUOTA_EXCEEDED_CODE.equals(code) || QUOTA_EXCEEDED_CODE_PADDED.equals(code)) {
                return true;
            }
        }
        return resultMsg != null && resultMsg.toUpperCase().contains(QUOTA_EXCEEDED_MESSAGE);
    }
}
