package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.model.CultureFacilitySourceDecision;
import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilitySourcePort;
import com.hondigagae.domainlayer.placeimport.application.port.out.ImportSourceSnapshotPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilityCsvFileQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilitySourceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import com.hondigagae.global.properties.CultureFacilityProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

/**
 * 이번 실행에서 무엇을 읽을지 정한다 (#379).
 *
 * <p>예전에는 사람이 받아 둔 파일 하나만 읽었다. 지금은 <b>포털에서 직접 받는 것이 기본</b>이고,
 * 직전 실행과 같은 파일이면 내려받기도 적재도 건너뛴다. 문화정보원 파일은 몇 달에 한 번 바뀌는데
 * 주 1회 파이프라인이 매번 30MB 를 받아 7만 행을 다시 파싱하고 있었다.
 *
 * <p><b>건너뛰기 판정은 두 단계다.</b> 먼저 상세 페이지에서 {@code atchFileId} 만 확인해 같으면
 * 30MB 를 받기 전에 끝낸다. 받은 뒤에는 바이트 수까지 맞춰 한 번 더 본다.
 *
 * <p><b>실패하면 로컬 우회 파일로 물러난다.</b> 포털 페이지 개편·다운로드 실패·받은 파일이
 * CSV 가 아님 — 어느 쪽이든 잡을 죽이는 대신 예전 경로로 적재한다. 낡은 데이터가 빈 데이터보다
 * 낫다는 원칙 그대로다({@code data-refresh-guide.md} 5절). 우회 파일마저 없으면 그때 실패한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CultureFacilitySourceProcessor {

    private final CultureFacilitySourcePort cultureFacilitySourcePort;
    private final ImportSourceSnapshotPort importSourceSnapshotPort;
    private final CultureFacilityProperties properties;

    /**
     * @param areaCode    적재 범위 관광 지역코드. 스냅샷 조회 범위와 적재 범위를 한 값에서 낸다
     * @param forceImport true 면 같은 파일이라도 다시 적재한다. 적재 로직을 고친 뒤 재적재할 때 쓴다
     */
    public CultureFacilitySourceDecision resolve(String areaCode, boolean forceImport) {
        if (!properties.downloadEnabled()) {
            log.info("culture facility source download disabled. using local file path={}", properties.filePath());
            return localFallbackOrThrow(null);
        }

        try {
            CultureFacilitySourceQueryResult source = cultureFacilitySourcePort.resolveLatest();
            Optional<ImportSourceSnapshot> latest = findLatestQuietly(areaCode);

            // 1단계: 크기를 모르는 시점이라 파일 식별자만 본다. 여기서 걸리면 30MB 를 받지 않는다.
            if (!forceImport && latest.filter(snapshot -> snapshot.sameFileAs(source.fileId(), null)).isPresent()) {
                return CultureFacilitySourceDecision.skipUnchanged(source.fileId());
            }

            CultureFacilityCsvFileQueryResult file = cultureFacilitySourcePort.download(source);

            // 2단계: 받은 바이트 수까지 맞춰 본다. 1단계에서 이미 식별자가 갈렸으므로 지금 규칙에서는
            // 거의 걸리지 않지만, atchFileId 가 바뀌는 규칙은 포털 운영 주체가 언제든 바꿀 수 있어
            // (예: 같은 파일에 새 id 를 붙임) 크기까지 같으면 적재를 건너뛰는 자리를 남겨 둔다.
            if (!forceImport && latest.filter(snapshot -> snapshot.sameFileAs(source.fileId(), file.contentLength())).isPresent()) {
                deleteQuietly(file.path());
                return CultureFacilitySourceDecision.skipUnchanged(source.fileId());
            }

            return CultureFacilitySourceDecision.importFrom(file.path(), source.fileId(), file.fileName(), file.contentLength());
        } catch (PlaceImportException exception) {
            return localFallbackOrThrow(exception);
        }
    }

    /**
     * 직전 스냅샷을 읽는다. <b>못 읽으면 "모른다"로 접는다.</b>
     *
     * <p>스냅샷은 건너뛰기를 위한 최적화지 적재의 전제가 아니다. prod 에 테이블이 아직 없거나
     * DB 가 잠깐 흔들려 조회가 깨졌다고 잡을 죽이면, <b>고칠 수 있었던 낡음이 빈 데이터가 된다</b>
     * ({@code data-refresh-guide.md} 5절의 "낡은 데이터가 빈 데이터보다 낫다"의 반대 방향이다).
     * 비어 있으면 첫 실행처럼 그냥 받아서 적재하면 되고, 그 결과가 새 스냅샷을 남긴다.
     */
    private Optional<ImportSourceSnapshot> findLatestQuietly(String areaCode) {
        try {
            return importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, areaCode);
        } catch (DataAccessException exception) {
            log.warn("culture facility snapshot unavailable — 다운로드로 진행 areaCode={} reason={}",
                areaCode, exception.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 임시 파일을 지운다. 적재가 끝났든 실패했든 부른다.
     *
     * <p><b>우회 파일은 절대 지우지 않는다.</b> 그것은 사람이 배포 호스트에 넣어 둔 마지막
     * 보루이고, 컨테이너에서는 읽기 전용으로 붙어 있어 지우려 들면 실패한다.
     */
    public void cleanUp(CultureFacilitySourceDecision decision) {
        if (decision.kind() != CultureFacilitySourceDecision.Kind.IMPORT || decision.fallback()) {
            return;
        }
        deleteQuietly(decision.csvFile());
    }

    private CultureFacilitySourceDecision localFallbackOrThrow(PlaceImportException cause) {
        Path local = Path.of(properties.filePath());
        if (Files.exists(local)) {
            if (cause != null) {
                log.warn("culture facility source fallback=local reason={} path={}", cause.getMessage(), local);
            }
            return CultureFacilitySourceDecision.fallback(local);
        }
        if (cause != null) {
            throw cause;
        }
        throw new PlaceImportException(PlaceImportErrorCode.CULTURE_CSV_NOT_FOUND, local.toString());
    }

    private void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            // 임시 디렉터리라 남아도 다음 기동에서 정리된다. 적재 성공을 이것 때문에 실패로 만들지 않는다.
            log.warn("culture facility temp file delete failed path={} reason={}", path, exception.getMessage());
        }
    }
}
