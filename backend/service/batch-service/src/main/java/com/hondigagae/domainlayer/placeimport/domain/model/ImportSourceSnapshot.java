package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.time.LocalDateTime;

/**
 * 원천 파일을 무엇으로 받았는지 남긴 스냅샷 (#379).
 *
 * <p>파일 하나를 통째로 다시 받는 원천(문화정보원)은 파일이 안 바뀌었는데도 매 주기 30MB 를
 * 내려받고 7만 행을 다시 파싱했다. 직전에 받은 것을 기록해 두면 다음 실행이 비교해서 건너뛴다.
 *
 * <p><b>키가 둘인 이유.</b> 주 키는 포털의 {@code atchFileId} 다 - 제공기관이 새 파일을 올리면
 * 바뀐다. 다만 그 규칙이 장기적으로 유지된다는 보장이 없어(운영 주체가 언제든 바꿀 수 있다)
 * 실제로 받은 바이트 수를 함께 남겨 교차 확인한다. {@code sourceModifiedMax}(CSV 의 최종작성일
 * 최대값)는 사람이 되짚을 때 쓰는 세 번째 근거다.
 *
 * @param source            장소 원천
 * @param areaCode          적재 범위 관광 지역코드. 적재·delist 범위와 같은 값이어야 한다
 * @param fileId            원천 파일 식별자 (문화정보원 = atchFileId)
 * @param fileName          Content-Disposition 파일명. 못 읽었으면 null
 * @param contentLength     실제로 받은 바이트 수
 * @param sourceModifiedMax 적재한 행의 최종작성일 최대값. 원천에 값이 없으면 null
 * @param importedCount     이번 실행에서 적재한 장소 수
 * @param runStartedAt      적재 시작 시각 (delist 기준 시각과 같은 값)
 */
public record ImportSourceSnapshot(
    PlaceSourceType source,
    String areaCode,
    String fileId,
    String fileName,
    long contentLength,
    LocalDateTime sourceModifiedMax,
    int importedCount,
    LocalDateTime runStartedAt
) {

    /**
     * 지금 원천이 내주는 파일이 이 스냅샷과 같은 파일인가.
     *
     * <p>크기를 아직 모르는 시점(내려받기 전)에는 {@code contentLength} 에 null 을 주고 파일
     * 식별자만 비교한다. 크기를 알면 둘 다 같아야 같은 파일로 본다 - 식별자만 같고 크기가
     * 달라졌다면 같은 자리에 다른 파일이 올라온 것이므로 적재해야 한다.
     */
    public boolean sameFileAs(String otherFileId, Long otherContentLength) {
        if (fileId == null || !fileId.equals(otherFileId)) {
            return false;
        }
        return otherContentLength == null || contentLength == otherContentLength;
    }
}
