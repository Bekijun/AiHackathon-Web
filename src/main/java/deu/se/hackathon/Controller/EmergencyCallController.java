package deu.se.hackathon.Controller;

import deu.se.hackathon.domain.EmergencyCall;
import deu.se.hackathon.dto.EmergencyCallDto;
import deu.se.hackathon.service.EmergencyCallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/emergency-calls")
public class EmergencyCallController {

    private final EmergencyCallService emergencyCallService;

    @PostMapping
    public ResponseEntity<EmergencyCall> create(@RequestBody EmergencyCallDto dto) {
        EmergencyCall saved = emergencyCallService.createEmergencyCall(dto);
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<List<EmergencyCall>> findAll() {
        return ResponseEntity.ok(emergencyCallService.getAllEmergencyCalls());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EmergencyCall> findById(@PathVariable Long id) {
        return ResponseEntity.ok(emergencyCallService.getEmergencyCall(id));
    }
}
