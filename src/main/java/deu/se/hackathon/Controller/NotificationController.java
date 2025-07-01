package deu.se.hackathon.Controller;

import deu.se.hackathon.domain.Notification;
import deu.se.hackathon.dto.NotificationDto;
import deu.se.hackathon.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping
    public Notification createNotification(@RequestBody NotificationDto dto) {
        return notificationService.createNotification(dto);
    }

    @GetMapping
    public List<Notification> getAllNotifications() {
        return notificationService.getAllNotifications();
    }

    @GetMapping("/{id}")
    public Notification getNotification(@PathVariable Long id) {
        return notificationService.getNotification(id);
    }
}
