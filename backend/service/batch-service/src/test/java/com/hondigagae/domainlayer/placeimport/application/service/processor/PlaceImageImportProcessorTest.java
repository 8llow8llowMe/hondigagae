package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import com.hondigagae.global.properties.PlaceImageImportProperties;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 추가 이미지 적재의 <b>커서 전진 규칙</b>과 실패 처리 검증 (#478).
 *
 * <p>대상 선정이 {@code place.image_synced_at} 순환이 되면서 "언제 커서를 미느냐" 가 곧 커버리지다.
 * 규칙은 하나다 — <b>원천에서 확정 답을 받았을 때만 민다.</b> 빈 응답과 한 곳 실패는 확정 답이라
 * 밀고(안 밀면 그 장소들이 NULL 머리를 독식한다), 한도 초과·서킷 오픈·키 누락은 아무 답도 받지
 * 못한 상태라 밀지 않는다(밀면 상한만큼의 장소가 빈손으로 한 바퀴 뒤로 간다).
 */
class PlaceImageImportProcessorTest {

    private static final int MAX_CALLS = 3;

    private final PlaceCatalogPort placeCatalogPort = mock(PlaceCatalogPort.class);
    private final PlaceImageBulkPort placeImageBulkPort = mock(PlaceImageBulkPort.class);
    private final PlaceImageImportProcessor processor = new PlaceImageImportProcessor(
        placeCatalogPort, placeImageBulkPort, new PlaceImageImportProperties(MAX_CALLS));

    @Test
    @DisplayName("실행당 상한을 대상 선정에 그대로 넘긴다 — 이게 빠지면 다시 전량 964콜이다")
    void passesConfiguredLimitToTargetSelection() {
        when(placeImageBulkPort.findTourApiTargets(MAX_CALLS)).thenReturn(List.of());

        assertThat(processor.importImages()).isZero();

        verify(placeImageBulkPort).findTourApiTargets(MAX_CALLS);
    }

    @Test
    @DisplayName("이미지를 받은 장소는 교체하고 커서를 민다")
    void movesCursorAfterSuccessfulReplace() {
        when(placeImageBulkPort.findTourApiTargets(MAX_CALLS)).thenReturn(List.of(target(1L, 100L)));
        when(placeCatalogPort.fetchDetailImages(100L)).thenReturn(List.of(image()));
        when(placeImageBulkPort.replaceImages(eq(1L), anyList())).thenReturn(1);

        assertThat(processor.importImages()).isEqualTo(1);

        verify(placeImageBulkPort).touchImageSyncedAt(1L);
    }

    @Test
    @DisplayName("원천이 이미지를 주지 않아도 커서를 민다 — 안 밀면 그 장소들이 순환 앞자리를 영원히 독식한다")
    void movesCursorWhenSourceReturnsNoImages() {
        when(placeImageBulkPort.findTourApiTargets(MAX_CALLS)).thenReturn(List.of(target(1L, 100L)));
        when(placeCatalogPort.fetchDetailImages(100L)).thenReturn(List.of());

        assertThat(processor.importImages()).isZero();

        // 빈 목록도 원천의 확정 답이다 — 갤러리를 내렸으면 기존 행도 내려간다
        verify(placeImageBulkPort).replaceImages(1L, List.of());
        verify(placeImageBulkPort).touchImageSyncedAt(1L);
    }

    @Test
    @DisplayName("한도 초과가 아닌 한 곳 실패도 커서를 민다 — 사라진 contentId 가 순환 머리에 고착하는 것을 막는다")
    void oneFailureDoesNotStopTheRestAndStillMovesCursor() {
        when(placeImageBulkPort.findTourApiTargets(MAX_CALLS))
            .thenReturn(List.of(target(1L, 100L), target(2L, 200L)));
        when(placeCatalogPort.fetchDetailImages(100L))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, "HTTP 500"));
        when(placeCatalogPort.fetchDetailImages(200L)).thenReturn(List.of(image()));
        when(placeImageBulkPort.replaceImages(eq(2L), anyList())).thenReturn(1);

        assertThat(processor.importImages()).isEqualTo(1);

        verify(placeCatalogPort, times(2)).fetchDetailImages(anyLong());
        verify(placeImageBulkPort, never()).replaceImages(eq(1L), any());
        verify(placeImageBulkPort).touchImageSyncedAt(1L);
        verify(placeImageBulkPort).touchImageSyncedAt(2L);
    }

    @Test
    @DisplayName("일일 한도에 닿으면 커서를 밀지 않고 남은 장소를 건너뛴다 — 예외로 스텝을 실패시키지는 않는다")
    void stopsQuietlyWithoutMovingCursorWhenDailyQuotaIsExhausted() {
        when(placeImageBulkPort.findTourApiTargets(MAX_CALLS))
            .thenReturn(List.of(target(1L, 100L), target(2L, 200L), target(3L, 300L)));
        when(placeCatalogPort.fetchDetailImages(100L)).thenReturn(List.of(image()));
        when(placeImageBulkPort.replaceImages(eq(1L), anyList())).thenReturn(1);
        when(placeCatalogPort.fetchDetailImages(200L))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED, "22 …"));

        // 첫 장소까지의 성과는 남고, 예외는 밖으로 나가지 않는다 (재실행이 멱등이라 다음 주에 따라잡는다)
        assertThat(processor.importImages()).isEqualTo(1);

        verify(placeCatalogPort, never()).fetchDetailImages(300L);
        verify(placeImageBulkPort, never()).replaceImages(eq(3L), anyList());
        // 답을 받지 못한 장소는 다음 실행의 앞자리에 그대로 남아야 한다
        verify(placeImageBulkPort, never()).touchImageSyncedAt(2L);
        verify(placeImageBulkPort, never()).touchImageSyncedAt(3L);
    }

    @Test
    @DisplayName("서킷이 열려 있으면 커서를 밀지 않고 스텝을 실패시킨다 — 상한만큼의 장소가 빈손으로 밀리는 것을 막는다")
    void rethrowsWhenCircuitIsOpen() {
        assertStopsTheStepWithoutMovingCursor(PlaceImportErrorCode.TOUR_API_CIRCUIT_OPEN);
    }

    @Test
    @DisplayName("서비스 키가 없으면 커서를 밀지 않고 스텝을 실패시킨다 — 키를 빠뜨린 배포 한 번이 3주짜리 공백을 만든다")
    void rethrowsWhenServiceKeyIsMissing() {
        assertStopsTheStepWithoutMovingCursor(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING);
    }

    private void assertStopsTheStepWithoutMovingCursor(PlaceImportErrorCode errorCode) {
        when(placeImageBulkPort.findTourApiTargets(MAX_CALLS))
            .thenReturn(List.of(target(1L, 100L), target(2L, 200L)));
        when(placeCatalogPort.fetchDetailImages(100L)).thenThrow(new PlaceImportException(errorCode));

        assertThatThrownBy(processor::importImages)
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(errorCode);

        // 남은 대상을 다 돌아도 결과가 같으니 두 번째 장소는 부르지 않는다
        verify(placeCatalogPort, never()).fetchDetailImages(200L);
        verify(placeImageBulkPort, never()).touchImageSyncedAt(anyLong());
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
