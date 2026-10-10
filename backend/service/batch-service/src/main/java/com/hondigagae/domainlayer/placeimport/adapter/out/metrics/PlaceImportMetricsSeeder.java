package com.hondigagae.domainlayer.placeimport.adapter.out.metrics;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 기동 시 Spring Batch 메타데이터에서 소스별 마지막 성공 시각을 되살린다.
 *
 * <p>게이지는 프로세스 메모리에만 있어 재기동하면 사라진다. 씨딩이 없으면 배포할 때마다
 * 데이터 신선도 패널이 다음 잡 실행 전까지 비어서 "데이터가 얼마나 낡았나"에 답하지 못한다.
 *
 * <p>씨딩은 best-effort 다. 메타데이터를 못 읽어도 기동을 막지 않는다 — 다음 잡 성공이
 * 지표를 다시 채운다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceImportMetricsSeeder implements ApplicationRunner {

    // 최근 실행이 전부 실패였을 수 있어, 성공을 찾을 때까지 거슬러 올라가는 폭
    private static final int INSTANCE_SCAN_LIMIT = 20;

    private static final Map<String, PlaceSourceType> SOURCE_BY_JOB_NAME = Map.of(
        "placeImportJob", PlaceSourceType.TOUR_API,
        "cultureFacilityImportJob", PlaceSourceType.CULTURE_PORTAL,
        "petRestaurantImportJob", PlaceSourceType.MFDS
    );

    private final JobExplorer jobExplorer;
    private final PlaceImportMetricsPort placeImportMetricsPort;

    @Override
    public void run(ApplicationArguments args) {
        SOURCE_BY_JOB_NAME.forEach(this::seedLastSuccess);
    }

    private void seedLastSuccess(String jobName, PlaceSourceType source) {
        try {
            jobExplorer.getJobInstances(jobName, 0, INSTANCE_SCAN_LIMIT).stream()
                .flatMap(instance -> jobExplorer.getJobExecutions(instance).stream())
                .filter(execution -> execution.getStatus() == BatchStatus.COMPLETED && execution.getEndTime() != null)
                .map(JobExecution::getEndTime)
                .max(Comparator.naturalOrder())
                .ifPresent(endTime -> placeImportMetricsPort.recordLastSuccess(
                    source, endTime.atZone(ZoneId.systemDefault()).toInstant()));
        } catch (RuntimeException exception) {
            log.warn("place import last-success seeding failed. jobName={} source={}", jobName, source, exception);
        }
    }
}
