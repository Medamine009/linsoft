package com.pfe.events.registrationservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthConverter jwtAuthConverter;

    public SecurityConfig(JwtAuthConverter jwtAuthConverter) {
        this.jwtAuthConverter = jwtAuthConverter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Sondes Kubernetes/OpenShift et scraping Prometheus : sans cette
                // ouverture, `anyRequest().authenticated()` renvoie 401 et le pod
                // est déclaré non sain en permanence.
                .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/registrations/*/verify").permitAll()
                // Check-in le jour J : réservé organisateur / admin
                .requestMatchers(HttpMethod.PUT, "/api/registrations/*/checkin", "/api/registrations/*/checkin/undo").hasAnyRole("ORGANISATEUR", "ADMIN")
                // Validation des demandes d'inscription : manager (organisateur) / admin
                .requestMatchers(HttpMethod.GET, "/api/registrations/pending").hasAnyRole("ORGANISATEUR", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/registrations/*/approve", "/api/registrations/*/reject").hasAnyRole("ORGANISATEUR", "ADMIN")
                // Gestion des certificats : la décision d'envoi appartient à l'administrateur
                .requestMatchers(HttpMethod.GET, "/api/registrations/certificates/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/registrations/certificates/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/registrations/*/certificate/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter))
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        return http.build();
    }
}
