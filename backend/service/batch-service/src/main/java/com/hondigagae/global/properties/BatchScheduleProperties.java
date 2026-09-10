package com.hondigagae.global.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 프로세스 안 Quartz 스케줄 설정.
 *
 * <p>주기 실행을 배포 호스트 cron 이 아니라 batch-service 프로세스 안에 둔 이유는
 * {@code QuartzScheduleConfig} javadoc 에 적었다. 여기서는 무엇을 언제 돌릴지만 정한다.
 *
 * <p>켜고 끄는 판단만 프로파일이 하고 ({@code application-dev.yml} 만 true), 나머지 값은 어느
 * 환경에서든 같은 뜻이라 compact constructor 에서 기본값을 채운다.
 *
 * <p><b>{@code enabled} 가 primitive 가 아니라 {@code Boolean} 인 이유.</b> compose 의
 * {@code ${BATCH_SCHEDULE_ENABLED:-}} 는 변수를 부재가 아니라 <b>빈 문자열</b>로 만든다. 빈 문자열은
 * 바인딩에서 null 로 떨어지는데, primitive 컴포넌트에 null 을 넣으려다 record 생성이 실패하면
 * 스케줄 스위치 하나가 배치 컨테이너 기동을 통째로 막는다. null 을 받아 false 로 접는 편이 낫다.
 * 트리거 등록 여부 자체는 이 값이 아니라 {@code ScheduleEnabledCondition} 이 문자열로 판정한다.
 *
 * @param enabled 스케줄러 사용 여부. 로컬·CI 는 꺼진다. null·빈 값은 꺼짐으로 본다
 * @param timeZone cron 을 해석할 시간대. JVM 기본 시간대에 기대지 않는다
 * @param placePipelineCron {@code placeDataPipelineJob} 발화 cron (Quartz 6~7 필드)
 * @param congestionCron {@code congestionImportJob} 발화 cron (Quartz 6~7 필드)
 * @param staleRunningAfter 이 시간을 넘긴 STARTED 실행은 죽은 JVM 의 잔재로 보고 무시한다
 */
@ConfigurationProperties(prefix = "batch.schedule")
public record BatchScheduleProperties(
    Boolean enabled,
    String timeZone,
    String placePipelineCron,
    String congestionCron,
    Duration staleRunningAfter
) {

    public BatchScheduleProperties {
        if (enabled == null) {
            enabled = false;
        }
        if (timeZone == null || timeZone.isBlank()) {
            timeZone = "Asia/Seoul";
        }
        if (placePipelineCron == null || placePipelineCron.isBlank()) {
            // 월요일 03:00. 새벽이라 TourAPI·VWorld 쿼터 경쟁이 적고, 출근 전에 결과를 볼 수 있다.
            placePipelineCron = "0 0 3 ? * MON";
        }
        if (congestionCron == null || congestionCron.isBlank()) {
            // 매일 06:00. 30일 rolling 원천이라 하루 한 번이면 충분하고,
            // 파이프라인(03:00)이 길어져도 겹치지 않을 만큼 떨어뜨렸다.
            congestionCron = "0 0 6 * * ?";
        }
        if (staleRunningAfter == null || staleRunningAfter.isZero() || staleRunningAfter.isNegative()) {
            staleRunningAfter = Duration.ofHours(6);
        }
    }
}
