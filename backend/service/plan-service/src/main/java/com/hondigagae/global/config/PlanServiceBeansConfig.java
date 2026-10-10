package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptConfigurer;
import com.hondigagae.common.config.SwaggerSecurityConfigurer;
import com.hondigagae.persistence.config.SnowflakeConfigurer;
import com.hondigagae.security.resourceserver.config.ResourceServerSecurityConfigurer;
import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptConfigurer.class,
    SnowflakeConfigurer.class,
    ResourceServerSecurityConfigurer.class,
    SwaggerSecurityConfigurer.class
})
public class PlanServiceBeansConfig {

    /** 서비스 기준 시간대. 국내 관광 데이터를 다루므로 "오늘" 은 언제나 KST 의 오늘이다. */
    private static final ZoneId SERVICE_ZONE = ZoneId.of("Asia/Seoul");

    /**
     * "오늘" 의 단일 출처.
     *
     * <p><b>시간대를 명시한다.</b> {@code -Duser.timezone} 은 배포 환경변수({@code TIME_ZONE})라 그 값
     * 하나로 자정 경계가 다른 나라 기준이 될 수 있다 — 일자 판정이 "지난 날짜" 를 하루 어긋나게
     * 말하면 사용자는 오늘 일정을 과거로 본다. batch-service 가 Quartz 트리거에 시간대를 못박는
     * 것과 같은 이유다 ({@code backend/docs/data-refresh-guide.md}).
     *
     * <p>빈으로 두는 이유는 테스트에서 고정하기 위해서다. Processor 가 {@code LocalDate.now()} 를
     * 직접 부르면 "지난 날짜" 분기는 실행 날짜에 따라 결과가 달라져 고정되지 않는다.
     */
    @Bean
    public Clock clock() {
        return Clock.system(SERVICE_ZONE);
    }
}
