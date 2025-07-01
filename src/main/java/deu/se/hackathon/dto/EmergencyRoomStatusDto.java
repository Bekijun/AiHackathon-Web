package deu.se.hackathon.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmergencyRoomStatusDto {
    private boolean available;
    private int currentPatients;
    private int totalCapacity;
}
