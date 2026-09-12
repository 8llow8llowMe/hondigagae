package com.hondigagae.domainlayer.planner.application.info;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.extern.slf4j.Slf4j;

/**
 * 일정을 만들 때 쓴 생성 조건의 application 표현.
 *
 * <p><b>새로 저장하는 값이 아니다.</b> 제출 시점에 이미
 * {@code AiPlanJob.requestParams} 로 저장돼 있고(멱등 해시의 재료이자 워커의 입력),
 * 이 표현은 그 문자열 맵을 응답 조립 시점에 타입으로 되돌린 것이다.
 *
 * <p>조건을 함께 내리는 이유는 <b>브라우저를 넘어가는 복원</b>이다. 없으면 프론트가
 * 제출 조건을 {@code sessionStorage} 에 들고 있어야 하고, 그 저장소는 탭·기기를 넘지
 * 못해 다른 브라우저에서 작업 주소를 열면 초안은 보이는데 담지 못한다 (#488).
 *
 * <p><b>초안을 담는 데 필요한 조건만 담는다.</b> 저장된 파라미터 중
 * {@code pinnedPlaceIds} · {@code preferFavorites} · {@code planId} · {@code regenerateDay} 는
 * 빠져 있다 — 담기(plan 저장)가 받지 않는 값이라서다. 실패 화면의 "조건 바꾸기" 가 폼을
 * 되살릴 때는 그 넷도 필요하므로, 그쪽 복원은 아직 프론트 저장소에 기댄다.
 *
 * <p>키 문자열의 정본은 쓰는 쪽인 {@code AiPlanJobProcessor#toParams} 다. 워커
 * ({@code AiPlanWorker#toQuery}) 도 같은 맵을 읽어 읽는 곳이 둘이라,
 * {@code AiPlanJobConditionsRoundTripTest} 가 그 키 집합을 고정한다.
 */
@Slf4j
@Builder
public record AiPlanConditionsInfo(
    String areaCode,
    // 생략 가능. 제출 때 없었으면 null 이다 — "지역 전체" 라는 뜻이다.
    String sigunguCode,
    LocalDate startDate,
    LocalDate endDate,
    // 제출이 지정한 반려견. 비어 있으면 지정하지 않았다는 뜻이고, 워커는 대표 반려견으로 대신했다.
    List<Long> petIds,
    // 생략 가능. 제출 때 없었으면 null 이다.
    Long budget,
    // 생략 가능. 제출 때 없었으면 null 이다.
    String requestNote
) {

    /**
     * 저장된 요청 파라미터를 조건으로 되돌린다.
     *
     * <p>빈 문자열은 "제출 때 없었다" 는 뜻이라 {@code null} 로 편다 — 쓰는 쪽이
     * 생략값을 빈 문자열로 적어 두기 때문이다. 화면이 빈 문자열과 미입력을 구분하려면
     * 여기서 접어야 한다.
     *
     * <p><b>해석할 수 없는 값은 그 칸만 비우고 넘어간다.</b> 저장소
     * ({@code RedisAiPlanJobStoreAdapter#findById}) 가 이미 "해석 못 하면 없는 것으로" 를
     * 택했는데 여기서 던지면 같은 손상 하나가 경로마다 다른 증상을 낸다 — 폴링은 코드 없는
     * 500 이 되고, SSE 는 구독 콜백이 예외를 삼켜 조용히 멈춘다. 조건은 초안에 덧붙는 값이지
     * 조회를 성립시키는 값이 아니라서, 못 읽는 칸 하나가 작업 전체를 못 보게 만들면 안 된다.
     */
    public static AiPlanConditionsInfo from(Map<String, String> requestParams) {
        if (requestParams == null || requestParams.isEmpty()) {
            return null;
        }
        return AiPlanConditionsInfo.builder()
            .areaCode(emptyToNull(requestParams.get("areaCode")))
            .sigunguCode(emptyToNull(requestParams.get("sigunguCode")))
            .startDate(parseDate(requestParams.get("startDate")))
            .endDate(parseDate(requestParams.get("endDate")))
            .petIds(parseIdList(requestParams.get("petIds")))
            .budget(parseNullableLong(requestParams.get("budget")))
            .requestNote(emptyToNull(requestParams.get("requestNote")))
            .build();
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static LocalDate parseDate(String value) {
        String normalized = emptyToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return LocalDate.parse(normalized);
        } catch (RuntimeException exception) {
            log.warn("AI 일정 작업의 저장된 날짜 조건을 해석할 수 없어 비웁니다. reason={}", exception.getMessage());
            return null;
        }
    }

    private static Long parseNullableLong(String value) {
        String normalized = emptyToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return Long.valueOf(normalized);
        } catch (NumberFormatException exception) {
            log.warn("AI 일정 작업의 저장된 예산 조건을 해석할 수 없어 비웁니다.");
            return null;
        }
    }

    /**
     * 쉼표로 이어 붙인 식별자 목록을 되돌린다. 해석할 수 없는 원소가 섞이면 <b>그것만 버리지
     * 않고 목록 전체를 비운다</b> — 한 마리가 조용히 사라진 목록은 "두 마리 중 한 마리로 짰다"
     * 는 거짓말이 되고, 화면은 그것을 사용자가 고른 조건으로 믿고 되돌려 보낸다.
     */
    private static List<Long> parseIdList(String value) {
        String normalized = emptyToNull(value);
        if (normalized == null) {
            return List.of();
        }
        try {
            return Arrays.stream(normalized.split(","))
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .map(Long::valueOf)
                .toList();
        } catch (NumberFormatException exception) {
            log.warn("AI 일정 작업의 저장된 반려견 조건을 해석할 수 없어 비웁니다.");
            return List.of();
        }
    }
}
