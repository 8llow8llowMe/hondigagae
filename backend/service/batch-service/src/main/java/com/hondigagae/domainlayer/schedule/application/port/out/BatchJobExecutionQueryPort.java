package com.hondigagae.domainlayer.schedule.application.port.out;

import com.hondigagae.domainlayer.schedule.application.port.out.query.RunningJobExecutionQueryResult;
import java.util.Collection;
import java.util.List;

/** 배치 메타데이터에서 실행 중인 잡을 읽는다. */
public interface BatchJobExecutionQueryPort {

    List<RunningJobExecutionQueryResult> findRunning(Collection<String> jobNames);
}
