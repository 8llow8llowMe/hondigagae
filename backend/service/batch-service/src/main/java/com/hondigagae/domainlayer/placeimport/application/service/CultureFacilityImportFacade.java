package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.model.CultureFacilityImportOutcome;
import com.hondigagae.domainlayer.placeimport.application.model.CultureFacilitySourceDecision;
import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.port.out.ImportSourceSnapshotPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilitySourceProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.DelistProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.EmergencyFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.enums.RegionCodeMapping;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 문화정보원 문화시설 적재 오케스트레이터.
 *
 * <p>원천 결정 → 여행 시설 적재 → delist → 긴급 시설(동물병원·동물약국) 적재를 잇달아 수행한다.
 * 원천 결정이 "직전과 같은 파일"이면 나머지를 전부 건너뛴다 (#379).
 *
 * <p>병합은 {@code placeMergeJob} 이 모든 적재 뒤에 한 번 한다(#363) — 적재마다 병합하면
 * 아직 다른 원천이 들어오지 않은 중간 상태로 판정한다.
 *
 * <p>{@code @Transactional}을 붙이지 않는 이유는 {@code PlaceImportFacade} 와 같다 —
 * 파일 파싱과 대량 upsert 를 한 트랜잭션으로 묶으면 커넥션을 오래 잡는다. 이제는 <b>30MB
 * 다운로드까지</b> 이 흐름 안에 있어 더더욱 그렇다. 재실행이 멱등이라 중간에 실패하면 잡을 다시
 * 돌리면 된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CultureFacilityImportFacade implements CultureFacilityImportUseCase {

    private final CultureFacilitySourceProcessor cultureFacilitySourceProcessor;
    private final CultureFacilityImportProcessor cultureFacilityImportProcessor;
    private final EmergencyFacilityImportProcessor emergencyFacilityImportProcessor;
    private final DelistProcessor delistProcessor;
    private final ImportSourceSnapshotPort importSourceSnapshotPort;
    private final PlaceImportMetricsPort placeImportMetricsPort;

    @Override
    public CultureFacilityImportResult importFacilities(String sido, boolean forceImport) {
        // delist 범위는 적재 범위와 반드시 같아야 한다. 예전에는 제주 코드를 상수로 박아 둬서,
        // 다른 시도로 잡을 돌리면 그 지역을 적재해 놓고 제주만 처리하는 조용한 어긋남이 났다.
        String areaCode = resolveAreaCode(sido);

        CultureFacilitySourceDecision decision = cultureFacilitySourceProcessor.resolve(areaCode, forceImport);
        recordFallbackFlag(decision);
        if (decision.kind() == CultureFacilitySourceDecision.Kind.SKIP_UNCHANGED) {
            return skipUnchanged(decision);
        }

        try {
            LocalDateTime runStartedAt = LocalDateTime.now();
            CultureFacilityImportOutcome outcome = cultureFacilityImportProcessor.importFacilities(decision.csvFile(), sido);
            int imported = outcome.imported();
            int delisted = delistProcessor.delistPlaces(PlaceSourceType.CULTURE_PORTAL, areaCode, runStartedAt, imported);
            // 같은 파일에 동물병원·동물약국이 함께 들어 있어 한 번 읽는 김에 같이 적재한다.
            int facilities = emergencyFacilityImportProcessor.importFacilities(decision.csvFile(), sido);
            delistProcessor.delistEmergencyFacilities(runStartedAt, facilities);

            // 긴급 시설 건수는 place 지표에 섞지 않는다 — place_import_rows 는 장소 마스터 기준이고,
            // 긴급 시설은 급감 가드 + 경고 로그가 별도로 지킨다.
            placeImportMetricsPort.recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.UPSERTED, imported);
            placeImportMetricsPort.recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.DELISTED, delisted);
            if (imported > 0) {
                // 신선도는 실제로 데이터가 들어온 실행만 갱신한다 (PlaceImportFacade 와 같은 이유)
                placeImportMetricsPort.recordLastSuccess(PlaceSourceType.CULTURE_PORTAL, Instant.now());
                recordSnapshot(decision, areaCode, outcome, runStartedAt);
            }
            return new CultureFacilityImportResult(imported, false, decision.fileId(), decision.fallback());
        } finally {
            cultureFacilitySourceProcessor.cleanUp(decision);
        }
    }

    /**
     * 원천 파일이 직전과 같아 적재를 건너뛴 실행.
     *
     * <p><b>건너뛰기도 신선도 갱신이다.</b> 포털을 실제로 확인해 "지금 올라와 있는 것이 우리가
     * 이미 적재한 그 파일"임을 안 실행이므로 데이터는 최신이다. 갱신하지 않으면 파일이 몇 달
     * 안 바뀌는 정상 상황에서 {@code place_import_last_success_timestamp} 14일 경보가 울린다 —
     * 아무 문제가 없는데 울리는 경보는 곧 무시당하고, 그러면 진짜 고장도 함께 묻힌다.
     *
     * <p>delist 도 부르지 않는다. 이번 실행이 아무 행도 건드리지 않았으므로 {@code synced_at}
     * 기준으로 보면 <b>전부 사라진 것처럼 보인다</b> — 급감 가드가 막아 주겠지만 애초에 부를 일이 아니다.
     */
    private CultureFacilityImportResult skipUnchanged(CultureFacilitySourceDecision decision) {
        log.info("culture facility import skipped unchanged fileId={}", decision.fileId());
        placeImportMetricsPort.recordLastSuccess(PlaceSourceType.CULTURE_PORTAL, Instant.now());
        return new CultureFacilityImportResult(0, true, decision.fileId(), false);
    }

    /**
     * 이번 실행이 우회 원천을 썼는지를 1/0 게이지로 남긴다 (#379).
     *
     * <p><b>모든 실행 경로에서 부른다</b> — 건너뛴 실행은 0 이다. 게이지는 마지막 실행 값만 담으므로
     * 우회했던 실행 다음에 정상 실행이 오면 0 으로 되돌아야 하고, 그러려면 정상 경로도 매번 써야 한다.
     *
     * <p>왜 필요한가. 우회 적재도 행이 들어오니 {@code last_success} 가 갱신되고, 그러면 포털
     * 자동 다운로드가 몇 주째 끊겨 매주 같은 로컬 파일을 다시 넣고 있어도 유일한 신선도 경보가
     * 침묵한다. WARN 로그 하나로는 그 상태를 아무도 보지 않는다.
     */
    private void recordFallbackFlag(CultureFacilitySourceDecision decision) {
        placeImportMetricsPort.recordRows(
            PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.FALLBACK, decision.fallback() ? 1 : 0);
    }

    /**
     * 다음 실행이 비교할 기준을 남긴다.
     *
     * <p><b>우회 적재는 남기지 않는다.</b> 우회 파일이 포털에 지금 올라와 있는 것과 같다는 보장이
     * 없다. 남기면 다음 실행이 포털을 보지 않고 건너뛰어, 포털이 되살아나도 낡은 파일에 머문다.
     *
     * <p>그 반대로 여기까지 온 결정은 반드시 포털에서 받은 것이므로 {@code contentLength} 가 있다
     * ({@code CultureFacilitySourceDecision.importFrom} 이 받은 바이트 수와 함께 만든다).
     */
    private void recordSnapshot(
        CultureFacilitySourceDecision decision, String areaCode, CultureFacilityImportOutcome outcome, LocalDateTime runStartedAt
    ) {
        if (decision.fallback()) {
            return;
        }
        importSourceSnapshotPort.record(new ImportSourceSnapshot(
            PlaceSourceType.CULTURE_PORTAL, areaCode, decision.fileId(), decision.fileName(),
            decision.contentLength(), outcome.sourceModifiedMax(), outcome.imported(), runStartedAt));
    }

    /**
     * 시도 명칭을 관광 지역코드로 옮긴다. 원천은 명칭으로 주고 place 테이블은 코드 체계라
     * 여기서 맞춰야 한다.
     *
     * <p>매핑에 없는 시도면 <b>적재를 시작하기 전에 실패시킨다.</b> 그대로 진행하면 delist
     * 범위가 비어 사라진 시설이 남거나, 예전처럼 엉뚱한 지역을 내리게 된다.
     * 지금 채워진 것은 제주뿐이다 - 검증되지 않은 전국 매핑을 미리 넣지 않는다는 방침이다
     * ({@link RegionCodeMapping}).
     */
    private String resolveAreaCode(String sido) {
        String areaCode = RegionCodeMapping.toAreaCode(sido);
        if (areaCode == null) {
            throw new PlaceImportException(PlaceImportErrorCode.REGION_NOT_SUPPORTED, sido);
        }
        return areaCode;
    }
}
