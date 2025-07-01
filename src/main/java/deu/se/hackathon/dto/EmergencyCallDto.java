package deu.se.hackathon.dto;

import deu.se.hackathon.domain.Patient;
import deu.se.hackathon.domain.User;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmergencyCallDto {
    private Long id;
    private LocalDateTime requestTime;
    private Long createdByUserId;
    private Long patientId;
}
