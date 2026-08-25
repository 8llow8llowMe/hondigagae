package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import com.hondigagae.common.config.SwaggerPropertiesConfig;
import com.hondigagae.persistence.config.SnowflakePropertiesConfig;
import com.hondigagae.redis.config.RedisPropertiesConfig;
import com.hondigagae.security.auth.config.JwtAuthPropertiesConfig;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptPropertiesConfig.class,
    SwaggerPropertiesConfig.class,
    JwtAuthPropertiesConfig.class,
    RedisPropertiesConfig.class,
    SnowflakePropertiesConfig.class
})
public class AuthServicePropertiesConfig {

}
