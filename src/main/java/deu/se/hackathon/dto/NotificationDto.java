package deu.se.hackathon.dto;

import lombok.Data;

@Data
public class NotificationDto {
    private Long hospitalId;
    private Long emergencyCallId;
    private boolean accepted;
}
