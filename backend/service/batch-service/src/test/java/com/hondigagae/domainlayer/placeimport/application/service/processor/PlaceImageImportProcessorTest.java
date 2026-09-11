package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImageBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceImageTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 추가 이미지 적재의 실패 처리 검증.
 *
 * <p>운영시간 스텝(#361)이 하루 예산을 먼저 쓰는 순서가 되면서, <b>이 스텝이 도중에 한도에 닿는
 * 것이 정상 경로</b>가 됐다. 그때 남은 장소를 계속 두드리면 매 실행 수백 건의 헛된 호출과 경고가
 * 쌓여 진짜 실패가 묻힌다.
 */
class PlaceImageImportProcessorTest {

    private final PlaceCatalogPort placeCatalogPort = mock(PlaceCatalogPort.class);
    private final PlaceImageBulkPort placeImageBulkPort = mock(PlaceImageBulkPort.class);
    private final PlaceImageImportProcessor processor =
        new PlaceImageImportProcessor(placeCatalogPort, placeImageBulkPort);

    @Test
    @DisplayName("일일 한도에 닿으면 남은 장소를 건너뛰고 끝낸다 — 예외로 스텝을 실패시키지는 않는다")
    void stopsQuietlyWhenDailyQuotaIsExhausted() {
        when(placeImageBulkPort.findTourApiTargets())
            .thenReturn(List.of(target(1L, 100L), target(2L, 200L), target(3L, 300L)));
        when(placeCatalogPort.fetchDetailImages(100L)).thenReturn(List.of(image()));
        when(placeImageBulkPort.replaceImages(eq(1L), anyList())).thenReturn(1);
        when(placeCatalogPort.fetchDetailImages(200L))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED, "22 …"));

        // 첫 장소까지의 성과는 남고, 예외는 밖으로 나가지 않는다 (재실행이 멱등이라 다음 주에 따라잡는다)
        assertThat(processor.importImages()).isEqualTo(1);

        verify(placeCatalogPort, never()).fetchDetailImages(300L);
        verify(placeImageBulkPort, never()).replaceImages(eq(3L), anyList());
    }

    @Test
    @DisplayName("한도 초과가 아닌 한 곳 실패는 기록하고 계속 간다 — 이미지는 보강 데이터다")
    void oneFailureDoesNotStopTheRest() {
        when(placeImageBulkPort.findTourApiTargets())
            .thenReturn(List.of(target(1L, 100L), target(2L, 200L)));
        when(placeCatalogPort.fetchDetailImages(100L))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, "HTTP 500"));
        when(placeCatalogPort.fetchDetailImages(200L)).thenReturn(List.of(image()));
        when(placeImageBulkPort.replaceImages(eq(2L), anyList())).thenReturn(1);

        assertThat(processor.importImages()).isEqualTo(1);

        verify(placeCatalogPort, times(2)).fetchDetailImages(anyLong());
        verify(placeImageBulkPort, never()).replaceImages(eq(1L), any());
    }

    private PlaceImageTargetQueryResult target(long placeId, long contentId) {
        return new PlaceImageTargetQueryResult(placeId, contentId);
    }

    private ImportedPlaceImage image() {
        return ImportedPlaceImage.builder()
            .originImgUrl("https://example.test/a.jpg")
            .serialNum("1")
            .build();
    }
}
