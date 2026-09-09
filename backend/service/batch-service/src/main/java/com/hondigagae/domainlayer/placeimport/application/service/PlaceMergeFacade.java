package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceMergeUseCase;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceMergeProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 중복 병합 유스케이스 오케스트레이터.
 *
 * <p>적재 파사드에서 떼어낸 독립 잡의 진입점이다(#363). 모든 적재가 끝난 상태를 기준으로
 * 한 번만 판정한다.
 *
 * <p>{@code @Transactional} 을 붙이지 않는다 — 병합은 흡수되는 행의 값을 살아남는 행의 빈 칸에
 * 옮긴 뒤(mergeFields) 병합 표시를 하는(markMerged) 두 단계인데, 두 단계가 각각 멱등이라
 * 중간에 끊겨도 잡을 다시 돌리면 치유된다(빈 칸만 채우는 COALESCE, {@code merged_into_id IS NULL}
 * 조건부 갱신). 다른 배치 파사드와 규칙을 같게 두는 편이 "어느 파사드가 트랜잭션을 갖는가"를
 * 되묻지 않게 한다.
 *
 * <p><b>지역코드는 시작 전에 검사한다.</b> 적재 파사드 안에 있을 때는 적재 범위(sido)에서 병합 범위를
 * 유도해 매핑에 없으면 먼저 실패했는데, 독립 잡이 되면서 운영자가 넣는 값이 됐다. 관광 API 코드가
 * 아닌 값(법정동 코드 50 등)이면 후보 조회가 0건으로 끝나 "성공" 으로 보이므로 여기서 막는다.
 */
@Service
@RequiredArgsConstructor
public class PlaceMergeFacade implements PlaceMergeUseCase {

    private final PlaceMergeProcessor placeMergeProcessor;

    @Override
    public int mergeDuplicates(String areaCode) {
        if (!RegionCodeMapping.isKnownAreaCode(areaCode)) {
            throw new PlaceImportException(PlaceImportErrorCode.REGION_NOT_SUPPORTED, areaCode);
        }
        return placeMergeProcessor.mergeDuplicates(areaCode);
    }
}
