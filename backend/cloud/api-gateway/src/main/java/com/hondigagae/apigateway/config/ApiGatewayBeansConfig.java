package com.hondigagae.apigateway.config;

import com.hondigagae.common.config.JasyptConfigurer;
import com.hondigagae.redis.config.RedisConfigurer;
import com.hondigagae.redis.config.RedisPropertiesConfig;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptConfigurer.class,
    RedisPropertiesConfig.class,
    RedisConfigurer.class
})
public class ApiGatewayBeansConfig {

}
