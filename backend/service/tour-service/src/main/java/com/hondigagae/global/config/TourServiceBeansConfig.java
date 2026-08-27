package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptConfigurer;
import com.hondigagae.common.config.SwaggerSecurityConfigurer;
import com.hondigagae.persistence.config.QuerydslConfigurer;
import com.hondigagae.persistence.config.SnowflakeConfigurer;
import com.hondigagae.redis.config.RedisConfigurer;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptConfigurer.class,
    QuerydslConfigurer.class,
    SnowflakeConfigurer.class,
    RedisConfigurer.class,
    SwaggerSecurityConfigurer.class
})
public class TourServiceBeansConfig {

}
