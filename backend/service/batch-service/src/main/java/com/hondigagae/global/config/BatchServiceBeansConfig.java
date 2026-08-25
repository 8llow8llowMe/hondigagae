package com.hondigagae.global.config;

import com.hondigagae.common.config.JasyptConfigurer;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import({
    JasyptConfigurer.class
})
public class BatchServiceBeansConfig {

}
