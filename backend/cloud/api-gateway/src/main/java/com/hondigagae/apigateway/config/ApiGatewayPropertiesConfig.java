package com.hondigagae.apigateway.config;

import com.hondigagae.common.config.JasyptPropertiesConfig;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import(JasyptPropertiesConfig.class)
public class ApiGatewayPropertiesConfig {

}
