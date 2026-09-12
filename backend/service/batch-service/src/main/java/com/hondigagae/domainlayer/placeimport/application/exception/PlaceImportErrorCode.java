package com.hondigagae.domainlayer.placeimport.application.exception;

import java.util.EnumSet;
import java.util.Set;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * batch-service는 웹 계층이 없어 HttpStatus는 두지 않는다.
 * 커스텀 코드는 배치 실패 로그에서 원인을 식별하는 용도로 사용한다.
 */
@Getter
@RequiredArgsConstructor
public enum PlaceImportErrorCode {

    TOUR_API_CALL_FAILED("PLACE_IMPORT_001", "TourAPI 호출에 실패했습니다. (%s)"),
    TOUR_API_RESPONSE_INVALID("PLACE_IMPORT_002", "TourAPI 응답 형식이 올바르지 않습니다. (%s)"),
    TOUR_API_SERVICE_KEY_MISSING("PLACE_IMPORT_003", "TourAPI 서비스 키(tour-api.service-key)가 설정되지 않았습니다."),
    PLACE_ID_GENERATION_FAILED("PLACE_IMPORT_004", "장소 식별자 생성에 실패했습니다."),
    CULTURE_CSV_NOT_FOUND("PLACE_IMPORT_005", "문화시설 CSV 파일을 찾을 수 없습니다. (%s)"),
    CULTURE_CSV_READ_FAILED("PLACE_IMPORT_006", "문화시설 CSV 파일을 읽지 못했습니다. (%s)"),
    CULTURE_CSV_COLUMN_MISSING("PLACE_IMPORT_007", "문화시설 CSV에 필요한 컬럼이 없습니다. (%s)"),
    MFDS_DOWNLOAD_FAILED("PLACE_IMPORT_008", "식약처 반려동물 동반출입 음식점 파일을 받지 못했습니다. (%s)"),
    MFDS_FILE_READ_FAILED("PLACE_IMPORT_009", "식약처 반려동물 동반출입 음식점 파일을 읽지 못했습니다. (%s)"),
    MFDS_COLUMN_MISSING("PLACE_IMPORT_010", "식약처 파일에 필요한 컬럼이 없습니다. (%s)"),
    GEOCODING_KEY_MISSING("PLACE_IMPORT_011", "VWorld 지오코더 키(vworld.api-key)가 설정되지 않았습니다."),
    // 서킷 오픈. 원천이 이미 죽어 있다는 뜻이므로 잡을 즉시 실패시킨다 -
    // 수천 건을 계속 두드려 봐야 쿼터만 태우고 잡 시간만 늘어난다.
    TOUR_API_CIRCUIT_OPEN("PLACE_IMPORT_012", "TourAPI 서킷이 열려 있어 호출을 건너뜁니다."),
    GEOCODING_CIRCUIT_OPEN("PLACE_IMPORT_013", "VWorld 지오코더 서킷이 열려 있어 호출을 건너뜁니다."),
    MFDS_CIRCUIT_OPEN("PLACE_IMPORT_014", "식약처 파일 서버 서킷이 열려 있어 내려받기를 건너뜁니다."),
    REGION_NOT_SUPPORTED("PLACE_IMPORT_015", "관광 지역코드로 옮길 수 없는 지역입니다. (%s)"),
    INTRO_JSON_SERIALIZE_FAILED("PLACE_IMPORT_016", "place_intro raw_json 직렬화에 실패했습니다. (sourceKey=%s)"),
    // 문화정보원 CSV 자동 다운로드 (#379). 여기 실패는 잡을 죽이지 않고 로컬 우회 파일로 물러난다 -
    // 우회 파일도 없을 때만 잡이 CULTURE_CSV_NOT_FOUND 로 끝난다.
    CULTURE_SOURCE_PAGE_FAILED("PLACE_IMPORT_017", "문화정보원 상세 페이지를 받지 못했습니다. (%s)"),
    CULTURE_SOURCE_PAGE_INVALID("PLACE_IMPORT_018", "문화정보원 상세 페이지에서 파일 다운로드 주소를 찾지 못했습니다. (%s)"),
    CULTURE_DOWNLOAD_FAILED("PLACE_IMPORT_019", "문화정보원 CSV 를 내려받지 못했습니다. (%s)"),
    // CSV 아님 · 하한 미달 · Content-Length 불일치(전송 중단)를 함께 받는다. 상세는 %s 자리에 담는다.
    CULTURE_DOWNLOAD_INVALID("PLACE_IMPORT_020", "내려받은 문화정보원 파일이 온전한 CSV 가 아닙니다. (%s)"),
    CULTURE_SOURCE_CIRCUIT_OPEN("PLACE_IMPORT_021", "공공데이터포털 서킷이 열려 있어 내려받기를 건너뜁니다."),
    // 일일 호출 한도 초과. 서킷이 잡지 못하는 실패다 — 원천은 200 에 오류 본문으로 답하므로
    // 전송은 성공한 것으로 보인다. 남은 대상을 다 돌아도 결과가 같으니 호출 반복을 멈춰야 한다.
    TOUR_API_QUOTA_EXCEEDED("PLACE_IMPORT_022", "TourAPI 일일 호출 한도를 초과했습니다. (%s)");

    /**
     * 한 곳의 실패로 넘기지 않고 스텝을 즉시 끝내야 하는 오류. 셋 다 <b>남은 대상을 다 돌아도
     * 결과가 같은</b> 상태다 — 원천이 죽었거나(서킷), 키가 없거나, 오늘 몫을 다 썼다.
     *
     * <p>계속 가면 시간만 태우는 것으로 끝나지 않는다. 두 상세 스텝(운영시간·추가 이미지)이
     * 모두 <b>증분 커서</b>로 대상을 고르므로, 실패한 장소마다 커서를 밀면 상한만큼의 장소가
     * 아무것도 받지 못한 채 순환에서 한 바퀴 뒤로 밀린다.
     */
    private static final Set<PlaceImportErrorCode> STOPS_THE_STEP = EnumSet.of(
        TOUR_API_CIRCUIT_OPEN,
        TOUR_API_SERVICE_KEY_MISSING,
        TOUR_API_QUOTA_EXCEEDED
    );

    private final String code;
    private final String message;

    /**
     * {@link #STOPS_THE_STEP} 판정. <b>두 프로세서가 같은 집합을 봐야 해서</b> 여기 둔다 —
     * 각자 적어 두면 한쪽만 고쳐지고, 그 어긋남은 원천이 실제로 죽은 날에만 드러난다.
     *
     * <p>한도 초과의 처리는 스텝마다 다르다. 운영시간 스텝은 그대로 예외를 올려 스텝을 실패로
     * 끝내고, 이미지 스텝은 <b>이 판정보다 먼저</b> 한도 초과를 가려내 조용히 멈춘다
     * (그 스텝에서는 예산 소진이 예외가 아니라 정상 경로다). 순서가 뒤집히면 이미지 스텝이
     * 매주 실패한다.
     */
    public static boolean stopsTheStep(PlaceImportErrorCode errorCode) {
        return STOPS_THE_STEP.contains(errorCode);
    }
}
