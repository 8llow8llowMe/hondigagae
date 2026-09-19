package com.hondigagae.domainlayer.placeimport.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.model.PlaceImportOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.application.service.processor.DelistProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceImageBackfillProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceImageImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceIntroImportProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.global.properties.PlaceImportVolumeProperties;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 적재 뒤 delist 로 넘어가기 전의 가드를 고정한다 (#726).
 *
 * <p>여기서 지키는 것 셋. 기대 범위를 벗어난 실행은 delist 도 신선도 갱신도 하지 않고 예외로
 * 끝나고, 부분 실행은 애초에 가드를 지나지 않으며(일부 contentType 만 도는 실행이 적게 들어오는
 * 것은 정상이다), 전량 실행은 <b>타입별 내역을 그대로 delist 에 넘긴다</b> — 어느 타입을 내릴지는
 * {@code DelistProcessor} 가 정한다({@code DelistProcessorTest}).
 *
 * <p>이미지 백필의 지역코드 가드도 여기서 고정한다. 루프 안에서 예외를 삼키는 구조라
 * 앞에서 막지 않으면 잡이 {@code COMPLETED} + {@code backfilled=0} 으로 조용히 끝난다.
 */
@ExtendWith(MockitoExtension.class)
class PlaceImportFacadeTest {

    private static final String AREA_CODE = "39";
    private static final int MIN_ROWS = 1_200;
    private static final int MAX_ROWS = 20_000;

    @Mock
    private PlaceImportProcessor placeImportProcessor;

    @Mock
    private DelistProcessor delistProcessor;

    @Mock
    private PlaceImageImportProcessor placeImageImportProcessor;

    @Mock
    private PlaceIntroImportProcessor placeIntroImportProcessor;

    @Mock
    private PlaceImageBackfillProcessor placeImageBackfillProcessor;

    @Mock
    private PlaceImportMetricsPort placeImportMetricsPort;

    @Captor
    private ArgumentCaptor<PlaceImportOutcome> outcomeCaptor;

    private PlaceImportFacade facade() {
        return new PlaceImportFacade(placeImportProcessor, delistProcessor, placeImageImportProcessor,
            placeIntroImportProcessor, placeImageBackfillProcessor, placeImportMetricsPort,
            new PlaceImportVolumeProperties(MIN_ROWS, MAX_ROWS));
    }

    /** 대상 타입에 건수를 고르게 나눈 정상 실행. 총 건수만 지정한다. */
    private void givenImported(List<PlaceContentType> contentTypes, int imported) {
        List<PlaceContentType> targets = (contentTypes == null || contentTypes.isEmpty())
            ? PlaceContentType.DEFAULT_IMPORT_TARGETS
            : contentTypes;
        Map<PlaceContentType, Integer> byContentType = new LinkedHashMap<>();
        int each = imported / targets.size();
        for (PlaceContentType target : targets) {
            byContentType.put(target, each);
        }
        byContentType.merge(targets.get(0), imported - each * targets.size(), Integer::sum);
        givenOutcome(contentTypes, byContentType);
    }

    private void givenOutcome(List<PlaceContentType> contentTypes, Map<PlaceContentType, Integer> byContentType) {
        given(placeImportProcessor.importPlaces(AREA_CODE, contentTypes))
            .willReturn(new PlaceImportOutcome(byContentType));
    }

    @Test
    @DisplayName("하한 미달이면 delist 전에 IMPORT_VOLUME_OUT_OF_RANGE 로 잡을 끊는다")
    void failsWhenImportedBelowMin() {
        // #726 당시 실제로 들어오던 건수. 이 상태로 delist 까지 돌면 멀쩡한 행이 stale 로 내려간다.
        givenImported(null, 880);

        assertThatThrownBy(() -> facade().importPlaces(AREA_CODE, null))
            .isInstanceOf(PlaceImportException.class)
            .hasMessageContaining("imported=880")
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.IMPORT_VOLUME_OUT_OF_RANGE);

        verify(delistProcessor, never()).delistPlacesByContentType(any(), any(), any(), any());
        // 신선도를 갱신하지 않아야 14일 경보도 함께 울린다.
        verify(placeImportMetricsPort, never()).recordLastSuccess(any(), any());
        // 몇 건이 들어와서 걸렸는지는 지표로 남는다 — 대시보드에서 바로 원인을 짚게.
        verify(placeImportMetricsPort).recordRows(PlaceSourceType.TOUR_API, PlaceImportResultType.UPSERTED, 880);
    }

    @Test
    @DisplayName("상한 초과면 같은 코드로 끊는다 — 지역 필터가 풀려 전국이 들어온 상태")
    void failsWhenImportedAboveMax() {
        givenImported(null, 58_000);

        assertThatThrownBy(() -> facade().importPlaces(AREA_CODE, null))
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.IMPORT_VOLUME_OUT_OF_RANGE);

        verify(delistProcessor, never()).delistPlacesByContentType(any(), any(), any(), any());
        verify(placeImportMetricsPort, never()).recordLastSuccess(any(), any());
    }

    @Test
    @DisplayName("범위 안이면 평소대로 delist 와 지표까지 간다")
    void passesWithinRange() {
        givenImported(null, 2_099);
        given(delistProcessor.delistPlacesByContentType(any(), any(), any(), any())).willReturn(7);

        assertThat(facade().importPlaces(AREA_CODE, null)).isEqualTo(2_099);

        verify(delistProcessor).delistPlacesByContentType(eq(PlaceSourceType.TOUR_API), eq(AREA_CODE), any(), any());
        verify(placeImportMetricsPort).recordRows(PlaceSourceType.TOUR_API, PlaceImportResultType.UPSERTED, 2_099);
        verify(placeImportMetricsPort).recordRows(PlaceSourceType.TOUR_API, PlaceImportResultType.DELISTED, 7);
        verify(placeImportMetricsPort).recordLastSuccess(any(), any(Instant.class));
    }

    @Test
    @DisplayName("타입 하나가 0건이어도 잡은 끝까지 간다 — 어느 타입을 내릴지는 타입별 내역을 받은 delist 가 정한다")
    void handsContentTypeBreakdownToDelist() {
        // 여행코스(25)는 지역 키와 무관하게 늘 0건이다(원천에 제주 여행코스가 없다).
        // 여기서 delist 를 통째로 건너뛰면 delist 가 영영 돌지 않는다.
        Map<PlaceContentType, Integer> byContentType = new LinkedHashMap<>();
        byContentType.put(PlaceContentType.TOURIST_SPOT, 560);
        byContentType.put(PlaceContentType.CULTURE, 98);
        byContentType.put(PlaceContentType.COURSE, 0);
        byContentType.put(PlaceContentType.LEPORTS, 137);
        byContentType.put(PlaceContentType.LODGING, 210);
        byContentType.put(PlaceContentType.SHOPPING, 395);
        byContentType.put(PlaceContentType.RESTAURANT, 699);
        givenOutcome(null, byContentType);

        assertThat(facade().importPlaces(AREA_CODE, null)).isEqualTo(2_099);

        verify(delistProcessor).delistPlacesByContentType(eq(PlaceSourceType.TOUR_API), eq(AREA_CODE), any(),
            outcomeCaptor.capture());
        assertThat(outcomeCaptor.getValue().importedContentTypes())
            .containsExactly(PlaceContentType.TOURIST_SPOT, PlaceContentType.CULTURE, PlaceContentType.LEPORTS,
                PlaceContentType.LODGING, PlaceContentType.SHOPPING, PlaceContentType.RESTAURANT);
        assertThat(outcomeCaptor.getValue().emptyContentTypes()).containsExactly(PlaceContentType.COURSE);
    }

    @Test
    @DisplayName("부분 실행은 가드를 지나지 않는다 — 일부 타입만 돌면 적은 것이 정상이다")
    void skipsGuardOnPartialRun() {
        List<PlaceContentType> contentTypes = List.of(PlaceContentType.RESTAURANT);
        givenImported(contentTypes, 120);

        assertThat(facade().importPlaces(AREA_CODE, contentTypes)).isEqualTo(120);

        // 부분 실행은 delist 도 하지 않으므로 가드가 막을 것도 없다.
        verify(delistProcessor, never()).delistPlacesByContentType(any(), any(), any(), any());
        verify(placeImportMetricsPort).recordLastSuccess(any(), any(Instant.class));
    }

    @Test
    @DisplayName("이미지 백필은 모르는 지역코드면 루프에 들어가기 전에 REGION_NOT_SUPPORTED 로 끊는다")
    void failsBackfillOnUnknownAreaCode() {
        // 법정동 코드(제주=50)를 잡 파라미터에 넣는 실수. 예전에는 대상마다 예외를 삼켜
        // COMPLETED + backfilled=0 으로 끝나고 대상 수 × 200ms 만 태웠다.
        assertThatThrownBy(() -> facade().backfillPlaceImages("50"))
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.REGION_NOT_SUPPORTED);

        verify(placeImageBackfillProcessor, never()).backfillImages(anyString());
    }

    @Test
    @DisplayName("이미지 백필은 아는 지역코드면 그대로 프로세서로 넘긴다")
    void delegatesBackfillOnKnownAreaCode() {
        given(placeImageBackfillProcessor.backfillImages(AREA_CODE)).willReturn(12);

        assertThat(facade().backfillPlaceImages(AREA_CODE)).isEqualTo(12);
    }
}
