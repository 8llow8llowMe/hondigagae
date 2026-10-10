package com.hondigagae.domainlayer.placeimport.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceMergeProcessor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 독립 잡이 되면서 지역코드가 운영자 입력값이 됐다(#363). 관광 API 코드가 아닌 값은 후보 조회가
 * 0건으로 끝나 "성공" 으로 보이므로 시작 전에 막는지 본다.
 */
class PlaceMergeFacadeTest {

    private final PlaceMergeProcessor placeMergeProcessor = mock(PlaceMergeProcessor.class);
    private final PlaceMergeFacade facade = new PlaceMergeFacade(placeMergeProcessor);

    @Test
    @DisplayName("알려진 관광 지역코드면 프로세서에 그대로 넘긴다")
    void delegatesForKnownAreaCode() {
        when(placeMergeProcessor.mergeDuplicates("39")).thenReturn(54);

        assertThat(facade.mergeDuplicates("39")).isEqualTo(54);
    }

    @Test
    @DisplayName("법정동 코드(50)처럼 관광 API 코드가 아닌 값은 시작 전에 REGION_NOT_SUPPORTED 로 거부한다")
    void rejectsUnknownAreaCodeBeforeQuerying() {
        assertThatThrownBy(() -> facade.mergeDuplicates("50"))
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.REGION_NOT_SUPPORTED);
        verify(placeMergeProcessor, never()).mergeDuplicates("50");
    }
}
