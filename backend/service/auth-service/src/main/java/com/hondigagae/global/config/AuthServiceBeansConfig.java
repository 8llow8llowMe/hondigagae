package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptConfigurer;
import com.hondigagae.common.config.SwaggerSecurityConfigurer;
import com.hondigagae.persistence.config.SnowflakeConfigurer;
import com.hondigagae.redis.config.RedisConfigurer;
import com.hondigagae.security.auth.config.AuthSecurityConfigurer;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptConfigurer.class,
    SnowflakeConfigurer.class,
    AuthSecurityConfigurer.class,
    RedisConfigurer.class,
    SwaggerSecurityConfigurer.class
})
public class AuthServiceBeansConfig {

}
