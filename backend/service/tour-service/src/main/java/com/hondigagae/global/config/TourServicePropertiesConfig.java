package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import com.hondigagae.common.config.SwaggerPropertiesConfig;
import com.hondigagae.global.properties.InsightProperties;
import com.hondigagae.global.properties.KmaApiProperties;
import com.hondigagae.persistence.config.SnowflakePropertiesConfig;
import com.hondigagae.redis.config.RedisPropertiesConfig;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptPropertiesConfig.class,
    SwaggerPropertiesConfig.class,
    SnowflakePropertiesConfig.class,
    RedisPropertiesConfig.class
})
@EnableConfigurationProperties({
    KmaApiProperties.class,
    InsightProperties.class
})
public class TourServicePropertiesConfig {

}
