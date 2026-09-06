package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptConfigurer;
import javax.sql.DataSource;
import org.springframework.batch.support.transaction.ResourcelessTransactionManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
@Import({
    JasyptConfigurer.class
})
public class BatchServiceBeansConfig {

    /**
     * JobRepository(배치 메타데이터)용 트랜잭션 매니저. 아래 taskletTransactionManager 를
     * 정의하는 순간 부트 자동 구성이 물러나므로 여기서 명시하고, Spring Batch 자동 구성이
     * 단일 주입으로 찾을 수 있게 {@code @Primary} 를 둔다.
     */
    @Primary
    @Bean
    public PlatformTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    /**
     * tasklet 스텝 전용 무자원 트랜잭션 매니저.
     *
     * <p>TaskletStep 은 execute() 전체를 스텝 트랜잭션으로 감싼다. 이 서비스의 tasklet 은
     * 수십 페이지의 HTTP 호출·대기를 품은 채 대량 upsert 를 반복하므로, DB 트랜잭션으로 감싸면
     * 실행 내내 커넥션과 upsert 행의 row lock 을 쥔다 — tour-service 의 같은 행 쓰기가
     * lock wait timeout 으로 죽고, 파사드들이 전제하는 "페이지 단위 보존"도 거짓이 된다.
     * 무자원 매니저를 주면 JdbcTemplate 이 statement 단위 autocommit 으로 돌고,
     * upsert 가 멱등이라 중간 실패는 재실행으로 복구한다.
     */
    @Bean
    public PlatformTransactionManager taskletTransactionManager() {
        return new ResourcelessTransactionManager();
    }
}
