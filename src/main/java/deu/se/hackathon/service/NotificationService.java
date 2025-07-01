package deu.se.hackathon.service;

import deu.se.hackathon.domain.EmergencyCall;
import deu.se.hackathon.domain.Hospital;
import deu.se.hackathon.domain.Notification;
import deu.se.hackathon.dto.NotificationDto;
import deu.se.hackathon.repository.EmergencyCallRepository;
import deu.se.hackathon.repository.HospitalRepository;
import deu.se.hackathon.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final HospitalRepository hospitalRepository;
    private final EmergencyCallRepository emergencyCallRepository;

    public Notification createNotification(NotificationDto dto) {
        Hospital hospital = hospitalRepository.findById(dto.getHospitalId())
                .orElseThrow(() -> new IllegalArgumentException("Hospital not found"));
        EmergencyCall call = emergencyCallRepository.findById(dto.getEmergencyCallId())
                .orElseThrow(() -> new IllegalArgumentException("EmergencyCall not found"));

        Notification notification = Notification.builder()
                .hospital(hospital)
                .emergencyCall(call)
                .accepted(dto.isAccepted())
                .build();

        return notificationRepository.save(notification);
    }

    public List<Notification> getAllNotifications() {
        return notificationRepository.findAll();
    }

    public Notification getNotification(Long id) {
        return notificationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
    }
}
