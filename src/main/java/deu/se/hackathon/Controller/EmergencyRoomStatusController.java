package deu.se.hackathon.Controller;

import deu.se.hackathon.dto.EmergencyRoomStatusDto;
import deu.se.hackathon.service.EmergencyRoomStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
public class EmergencyRoomStatusController {

    private final EmergencyRoomStatusService emergencyRoomStatusService;

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestBody EmergencyRoomStatusDto dto) {
        emergencyRoomStatusService.updateStatus(id, dto);
        return ResponseEntity.ok("업데이트 완료");
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<EmergencyRoomStatusDto> getStatus(@PathVariable Long id) {
        EmergencyRoomStatusDto status = emergencyRoomStatusService.getStatus(id);
        return ResponseEntity.ok(status);
    }
}
