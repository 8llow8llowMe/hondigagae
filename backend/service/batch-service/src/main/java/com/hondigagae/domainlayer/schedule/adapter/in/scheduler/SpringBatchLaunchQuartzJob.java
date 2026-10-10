package com.hondigagae.domainlayer.schedule.adapter.in.scheduler;

import com.hondigagae.domainlayer.schedule.application.command.ScheduledLaunchCommand;
import com.hondigagae.domainlayer.schedule.application.exception.ScheduleException;
import com.hondigagae.domainlayer.schedule.application.port.in.ScheduledJobLaunchUseCase;
import java.util.Arrays;
import java.util.List;
import lombok.Setter;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

/**
 * Quartz 트리거를 유스케이스 호출로 옮기는 얇은 진입점.
 *
 * <p><b>이 클래스만 생성자 주입을 쓰지 못한다.</b> Quartz 는 {@code JobDetail} 에 적힌 클래스를
 * 기본 생성자로 직접 만들고, 부트가 등록한 {@code SpringBeanJobFactory} 가 그 뒤에 세터/필드로
 * 의존성을 채운다. 생성자 파라미터를 두면 인스턴스화 자체가 실패한다.
 *
 * <p>{@code @DisallowConcurrentExecution} 은 같은 JobKey 의 중복 발화만 막는다. 서로 다른 잡끼리의
 * 겹침과 수동 실행 JVM 과의 겹침은 {@code RunningJobGuardProcessor} 가 배치 메타데이터로 본다.
 */
@DisallowConcurrentExecution
public class SpringBatchLaunchQuartzJob extends QuartzJobBean {

    /** 실행할 배치 잡 이름. {@code JobDataMap} 에서 읽는다. */
    public static final String JOB_NAME_KEY = "jobName";

    /** 돌고 있으면 이번 발화를 건너뛸 잡 이름들. 콤마로 구분한다. */
    public static final String BLOCKED_BY_KEY = "blockedBy";

    private static final String BLOCKED_BY_SEPARATOR = ",";

    @Setter(onMethod_ = @Autowired)
    private ScheduledJobLaunchUseCase scheduledJobLaunchUseCase;

    @Override
    protected void executeInternal(JobExecutionContext context) throws JobExecutionException {
        JobDataMap jobDataMap = context.getMergedJobDataMap();
        String jobName = jobDataMap.getString(JOB_NAME_KEY);
        List<String> blockedBy = parseBlockedBy(jobDataMap.getString(BLOCKED_BY_KEY));

        try {
            scheduledJobLaunchUseCase.launch(new ScheduledLaunchCommand(jobName, blockedBy, context.getFireTime().toInstant()));
        } catch (ScheduleException exception) {
            // refireImmediately=false — 원인이 "잡이 없다"나 "이미 완료된 JobInstance" 라
            // 즉시 재시도해도 같은 결과다. 다음 주기에 다시 시도한다.
            throw new JobExecutionException(exception, false);
        }
    }

    private List<String> parseBlockedBy(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return List.of();
        }
        return Arrays.stream(rawValue.split(BLOCKED_BY_SEPARATOR))
            .map(String::trim)
            .filter(name -> !name.isEmpty())
            .toList();
    }
}
