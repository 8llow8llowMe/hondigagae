package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import com.hondigagae.global.properties.TourApiProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptPropertiesConfig.class
})
@EnableConfigurationProperties({
    TourApiProperties.class
})
public class BatchServicePropertiesConfig {

}
